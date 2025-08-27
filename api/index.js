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
  console.log("➡️ Incoming request:", req.method, req.url);

  if (req.method === "OPTIONS") {
    console.log("🟡 Preflight OPTIONS request detected for:", req.url);
  }

  try {
    await ensureDB();
    return wrapped(req, res);
  } catch (err) {
    console.error("❌ DB connection error:", err);
    res.status(500).json({ error: "DB connection failed" });
  }
}
