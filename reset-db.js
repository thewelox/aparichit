const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data', 'aparichit.db'));

const cleanupQueries = [
  "DELETE FROM judgements WHERE text IS NULL OR TRIM(text) = ''",
  "DELETE FROM people WHERE name IS NULL OR TRIM(name) = ''",
];

db.serialize(() => {
  cleanupQueries.forEach((query) => {
    db.run(query, (err) => {
      if (err) {
        console.error('Cleanup failed:', err.message);
      }
    });
  });
});

db.close(() => {
  console.log('Cleaned stale null entries.');
});
