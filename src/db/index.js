import mongoose from "mongoose";

const DB_NAME = "bujji";

const connectDB = async () => {
  try {
    console.log("🔗 Trying to connect to MongoDB...");
    console.log("👉 Using URI:", process.env.MONGO_URI ? "Loaded ✅" : "Not Found ❌");
    console.log("👉 Full Connection String:", `${process.env.MONGO_URI}/${DB_NAME}`);

    const conn = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`, {
      serverSelectionTimeoutMS: 10000, // 10s fail-fast
      retryWrites: true,
      w: "majority",
    });

    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:");
    console.error("   Message:", err.message);
    console.error("   Name:", err.name);
    console.error("   Stack:", err.stack);
    throw err; // don't exit in serverless
  }
};

export default connectDB;
