import mongoose from "mongoose";

const DB_NAME = "bujji";

const buildMongoConnectionString = () => {
  const rawMongoUri = process.env.MONGO_URI?.trim();

  if (!rawMongoUri) {
    throw new Error("MONGO_URI is missing from environment variables");
  }

  const hasExplicitDatabaseName = /mongodb(?:\+srv)?:\/\/[^\s/]+\/[^/?]+(?:\?.*)?$/.test(rawMongoUri);
  return hasExplicitDatabaseName ? rawMongoUri : `${rawMongoUri}/${DB_NAME}`;
};

const connectDB = async () => {
  try {
    const connectionString = buildMongoConnectionString();

    console.log("🔗 Trying to connect to MongoDB...");
    console.log("👉 Using URI:", process.env.MONGO_URI ? "Loaded ✅" : "Not Found ❌");
    console.log("👉 Full Connection String:", connectionString);

    const conn = await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
      w: "majority",
    });

    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:");
    console.error("   Message:", err.message);
    console.error("   Name:", err.name);
    console.error("   Stack:", err.stack);
    throw err;
  }
};

export default connectDB;
