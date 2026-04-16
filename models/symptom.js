import mongoose from "mongoose";

const symptomSchema = new mongoose.Schema(
  {
    userMessage: String,
    aiResponse: String,
  },
  { timestamps: true }
);

export default mongoose.model("Symptom", symptomSchema);