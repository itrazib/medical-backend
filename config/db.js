// import mongoose from 'mongoose';

// const connectDB = async () => {
//   try {
//     mongoose.set("strictQuery", false);
//     const conn = await mongoose.connect(process.env.MONGODB_URI);
//     console.log(`Database connected : ${conn.connection.host}`);
//     console.log(`Database connected : ${conn.connection.name}`);
//   } catch (err) {
//     console.log(err);
//   }
// };

// export default connectDB;
import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    mongoose.set("strictQuery", false);

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    isConnected = true;

    console.log("MongoDB connected:", conn.connection.host);
  } catch (err) {
    console.log("MongoDB error:", err.message);
    throw err; // VERY IMPORTANT
  }
};

export default connectDB;