import dotenv from "dotenv";
import app from "../src/app.js";
import connectDB from "../src/db/index.js";

dotenv.config({ path: ".env" });

let dbConnected = false;

export default async function handler(req, res) {
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

  if (req.method === "OPTIONS") {
    return res.status(200).end(); 
  }

  return app(req, res);
}
