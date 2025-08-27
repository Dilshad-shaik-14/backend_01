// api/index.js
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
  // ✅ Handle preflight immediately (no DB, no app)
 /* if (req.method === "OPTIONS") {
    console.log("🔵 OPTIONS request reached backend");

    res.setHeader(
      "Access-Control-Allow-Origin",
      process.env.CORS_ORIGIN || "http://localhost:5173"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-csrf-token");

    return res.status(200).end(); // ✅ bail out cleanly
  } */

  // ✅ only connect DB for real requests
  try {
    await ensureDB();
    return wrapped(req, res);
  } catch (err) {
    console.error("❌ DB connection error:", err);
    return res.status(500).json({ error: "DB connection failed" });
  }
}
