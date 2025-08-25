import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({ path: './env' });

connectDB()
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection failed:", err));

// No app.listen here — Vercel handles HTTP requests
export default app;
