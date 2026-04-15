const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

if (!global.__mongooseCache) {
  global.__mongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add it in your environment variables.");
  }

  if (global.__mongooseCache.conn) {
    return global.__mongooseCache.conn;
  }

  if (!global.__mongooseCache.promise) {
    global.__mongooseCache.promise = mongoose
      .connect(MONGODB_URI, {
        autoIndex: true
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  global.__mongooseCache.conn = await global.__mongooseCache.promise;
  return global.__mongooseCache.conn;
}

module.exports = { connectDB };
