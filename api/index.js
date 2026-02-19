/**
 * Vercel serverless entry. Connects to MongoDB before handling each request
 * so that Mongoose operations never buffer (fixes "buffering timed out" on cold start).
 */
require('dotenv').config();
const app = require('../dist/app.js').default;
const { connectDB } = require('../dist/config/db.js');

module.exports = async (req, res) => {
  await connectDB();
  app(req, res);
};
