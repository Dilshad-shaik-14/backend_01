// src/index.js
import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";

dotenv.config();

const PORT = process.env.PORT || 8000;

// Only run DB connect + listen for local development
if (process.env.NODE_ENV !== "production") {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Local server running on port ${PORT}`);
      });
    })
    .catch(err => console.error("MongoDB connection failed:", err));
}

// For Vercel serverless: pass every request into Express
export default async function handler(req, res) {
  try {
    if (!global.__DB_CONNECTED) {
      await connectDB();
      global.__DB_CONNECTED = true;
      console.log("DB connected (serverless warm).");
    }
  } catch (err) {
    console.error("DB connect (serverless) failed:", err);
  }

  return app(req, res);
}
