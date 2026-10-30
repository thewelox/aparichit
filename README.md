# APARICHIT

Anonymous friend-only judging board with a live chat and a grim skull look.

## Features
- Add any person to the board with their name attached to the entry
- Leave anonymous or named verdicts for each person
- Live chat using Socket.IO
- SQLite persistence for people, verdicts, and chat history
- Dark grim skull aesthetic with a bare, brutal look
- Responsive layout for desktop, tablet, and mobile

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   ```bash
   npm start
   ```

3. Open in browser:
   ```text
   http://localhost:3000
   ```

## Deploy

This project is best deployed on a Node host that supports persistent file storage.

### Option 1: Render
1. Push the project to GitHub.
2. Create a new Web Service on Render.
3. Connect the GitHub repo.
4. Set the start command:
   ```bash
   npm start
   ```
5. Keep the project root as the app directory.
6. Add a persistent disk if you want chat and board data to survive redeploys.

### Option 2: Railway
1. Import the repo into Railway.
2. Set the root directory to the project folder.
3. Use the default Node build settings.
4. Start command:
   ```bash
   npm start
   ```
5. Use Railway volumes or a managed database for long-term persistence.

### Option 3: VPS / Linux server
1. Copy the project to the server.
2. Install Node.js and npm.
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name aparichit
   ```

## Notes
- SQLite stores data in the `data/aparichit.db` folder.
- For production, make sure the host keeps that folder writable and persistent.
- If you want a public deployment, add a reverse proxy or host behind HTTPS.
