import dotenv from "dotenv";
import app from "../src/app.js";
import connectDB from "../src/db/index.js";

dotenv.config({ path: ".env" });

let dbConnected = false;

export default async function handler(req, res) {
  const corsOrigin = process.env.CORS_ORIGIN || "https://dsapp-theta.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-csrf-token"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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

  return app(req, res);
}
