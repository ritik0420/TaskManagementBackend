import 'dotenv/config';
import http from 'http';
import { connectDB } from './config/db.js';
import app from './app.js';
import { initSocket, setIO } from './socket/index.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const server = http.createServer(app);
  const io = initSocket(server);
  setIO(io);
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
