import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import serverless from "serverless-http";

dotenv.config({ path: "./env" });

// Connect to MongoDB
await connectDB()
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection failed:", err));

// Export as Vercel serverless function
export const handler = serverless(app);
