import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({ path: "./env" });

// Connect to MongoDB
await connectDB()
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection failed:", err));

// Vercel serverless export
export default (req, res) => app(req, res);
