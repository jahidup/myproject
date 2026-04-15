// Vercel catch-all function so `/api/*` routes reach the Express app.
// The app itself defines routes like `/api/login`, `/api/tests`, etc.
const app = require("./index");

module.exports = app;
