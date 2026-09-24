import mongoose from "mongoose";

// Defense-in-depth: wrap any remaining $ operators in filters with $eq
// so operator injection can never alter query logic, even if a future
// controller forgets strict type checks.
mongoose.set("sanitizeFilter", true);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Successfully connnected to mongoDB 👍`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
