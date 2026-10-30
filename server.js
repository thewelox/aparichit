const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'aparichit.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS judgements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        author TEXT DEFAULT 'Anonymous',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(person_id) REFERENCES people(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author TEXT DEFAULT 'Anonymous',
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

function formatMessage(entry) {
  return {
    id: entry.id,
    author: entry.author || 'Anonymous',
    message: entry.message,
    created_at: entry.created_at,
  };
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'APARICHIT is live.' });
});

app.get('/api/people', (_req, res) => {
  db.all('SELECT * FROM people ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Failed to load people:', err.message);
      return res.status(500).json({ error: 'Could not load people' });
    }

    const tasks = rows.map((person) => {
      return new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM judgements WHERE person_id = ? ORDER BY created_at DESC',
          [person.id],
          (judgementErr, judgementRows) => {
            if (judgementErr) {
              reject(judgementErr);
              return;
            }

            const safeJudgements = judgementRows.filter(
              (entry) => entry && String(entry.text || '').trim() !== ''
            );

            resolve({
              id: person.id,
              name: person.name || 'Unnamed',
              created_at: person.created_at,
              judgement_count: safeJudgements.length,
              judgements: safeJudgements,
            });
          }
        );
      });
    });

    Promise.all(tasks)
      .then((formatted) => res.json(formatted))
      .catch((error) => {
        console.error('Failed to map people and judgements:', error.message);
        res.status(500).json({ error: 'Could not load people' });
      });
  });
});

app.post('/api/people', (req, res) => {
  const name = String(req.body.name || '').trim();

  db.run(
    'INSERT INTO people (name) VALUES (?)',
    [name || 'Unnamed'],
    function onInsert(err) {
      if (err) {
        console.error('Failed to create person:', err.message);
        return res.status(500).json({ error: 'Could not add person.' });
      }

      const insertedPerson = {
        id: this.lastID,
        name: name || 'Unnamed',
        created_at: new Date().toISOString(),
        judgement_count: 0,
        judgements: [],
      };

      io.emit('person:added', insertedPerson);
      res.status(201).json(insertedPerson);
    }
  );
});

app.get('/api/people/:id/judgements', (req, res) => {
  const personId = Number(req.params.id);

  db.all(
    'SELECT * FROM judgements WHERE person_id = ? ORDER BY created_at DESC',
    [personId],
    (err, rows) => {
      if (err) {
        console.error('Failed to load judgements:', err.message);
        return res.status(500).json({ error: 'Could not load judgements.' });
      }

      res.json(rows);
    }
  );
});

app.post('/api/people/:id/judgements', (req, res) => {
  const personId = Number(req.params.id);
  const text = String(req.body.text || '').trim();
  const author = String(req.body.author || '').trim() || 'Anonymous';

  if (!text) {
    return res.status(400).json({ error: 'A verdict is required.' });
  }

  db.run(
    'INSERT INTO judgements (person_id, text, author) VALUES (?, ?, ?)',
    [personId, text, author],
    function onInsert(err) {
      if (err) {
        console.error('Failed to add judgement:', err.message);
        return res.status(500).json({ error: 'Could not save judgement.' });
      }

      const judgement = {
        id: this.lastID,
        person_id: personId,
        text,
        author,
        created_at: new Date().toISOString(),
      };

      io.emit('judgement:added', { personId, judgement });
      res.status(201).json(judgement);
    }
  );
});

app.get('/api/chat', (_req, res) => {
  db.all(
    'SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT 200',
    (err, rows) => {
      if (err) {
        console.error('Failed to load chat messages:', err.message);
        return res.status(500).json({ error: 'Could not load chat.' });
      }

      res.json(rows.map(formatMessage));
    }
  );
});

app.post('/api/chat', (req, res) => {
  const author = String(req.body.author || '').trim() || 'Anonymous';
  const message = String(req.body.message || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  db.run(
    'INSERT INTO chat_messages (author, message) VALUES (?, ?)',
    [author, message],
    function onInsert(err) {
      if (err) {
        console.error('Failed to save chat message:', err.message);
        return res.status(500).json({ error: 'Could not send message.' });
      }

      const created = {
        id: this.lastID,
        author,
        message,
        created_at: new Date().toISOString(),
      };

      io.emit('chat:message', formatMessage(created));
      res.status(201).json(formatMessage(created));
    }
  );
});

io.on('connection', (socket) => {
  db.all('SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT 200', (err, rows) => {
    if (!err) {
      socket.emit('chat:history', rows.map(formatMessage));
    }
  });

  socket.on('chat:message', (payload = {}) => {
    const author = String(payload.author || '').trim() || 'Anonymous';
    const message = String(payload.message || '').trim();

    if (!message) {
      return;
    }

    db.run(
      'INSERT INTO chat_messages (author, message) VALUES (?, ?)',
      [author, message],
      function onInsert(err) {
        if (err) {
          console.error('Socket chat insert failed:', err.message);
          return;
        }

        const created = {
          id: this.lastID,
          author,
          message,
          created_at: new Date().toISOString(),
        };

        io.emit('chat:message', formatMessage(created));
      }
    );
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase();

server.listen(PORT, () => {
  console.log(`APARICHIT is running on http://localhost:${PORT}`);
});
