import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";

dotenv.config();

const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV !== "production") {
  // 🟢 Local only
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running locally on port ${PORT}`);
      });
    })
    .catch(err => console.log("❌ MongoDB connection failed:", err));
}

// 🟢 Needed for Vercel
export default app;
