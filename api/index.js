import dotenv from "dotenv";
dotenv.config();

import serverless from "serverless-http";
import app from "../src/app.js";
import connectDB from "../src/db/index.js";

let dbConnected = false;

async function ensureDB() {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
    console.log("✅ MongoDB connected");
  }
}

const wrapped = serverless(app);

export default async function handler(req, res) {
  // Always set CORS headers manually at Vercel edge
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.CORS_ORIGIN || "http://localhost:5173"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-csrf-token"
  );

  // Handle OPTIONS requests directly
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await ensureDB();
    await wrapped(req, res); // ✅ Await the wrapped function
  } catch (err) {
    console.error("❌ DB connection error:", err);

    // Ensure CORS headers are set even on error
    res.setHeader(
      "Access-Control-Allow-Origin",
      process.env.CORS_ORIGIN || "http://localhost:5173"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    res.status(500).json({ error: "DB connection failed" });
  }
}
