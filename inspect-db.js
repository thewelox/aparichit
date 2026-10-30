const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'data', 'aparichit.db'));

db.all('SELECT * FROM people', (err, people) => {
  if (err) {
    console.error('People error:', err.message);
  } else {
    console.log('PEOPLE', JSON.stringify(people, null, 2));
  }
  db.all('SELECT * FROM judgements', (judgErr, judgements) => {
    if (judgErr) {
      console.error('Judgements error:', judgErr.message);
    } else {
      console.log('JUDGEMENTS', JSON.stringify(judgements, null, 2));
    }
    db.close();
  });
});
