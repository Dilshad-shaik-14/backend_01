import mongoose from "mongoose";

const DB_NAME = "bujji";


const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected !! DB HOST : ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MONGO DB connection error", error);
        process.exit(1)
    }
}


export default connectDB