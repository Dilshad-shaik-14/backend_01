import mongoose from "mongoose";

const DB_NAME = "bujji";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`, {
      serverSelectionTimeoutMS: 10000, // ⏱ 10s fail-fast
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err; // ❌ Don't call process.exit(1) in serverless
  }
};

export default connectDB;
