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
    return app(req, res);
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

// Local development server
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  ensureDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`⚙️  Server is running locally at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ Local server failed to start:", err);
    });
}
