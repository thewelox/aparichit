const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data', 'aparichit.db'));

db.serialize(() => {
  db.run('DELETE FROM chat_messages');
  db.run('DELETE FROM judgements');
  db.run('DELETE FROM people');
  db.run("DELETE FROM sqlite_sequence WHERE name = 'people'");
  db.run("DELETE FROM sqlite_sequence WHERE name = 'judgements'");
  db.run("DELETE FROM sqlite_sequence WHERE name = 'chat_messages'");
});

db.close(() => {
  console.log('Database reset and autoincrement counters cleared.');
});
