import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";

dotenv.config();

let dbConnected = false;

export default async function handler(req, res) {
  // Connect to MongoDB once
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
      console.log("MongoDB connected");
    } catch (err) {
      console.error("MongoDB connection failed:", err);
      return res.status(500).json({ status: "error", message: "DB connection failed" });
    }
  }

  // Always set CORS headers
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-csrf-token");

  // Return 200 for preflight requests
  if (req.method === "OPTIONS") return res.status(200).end();

  // Forward everything else to Express
  return app(req, res);
}
