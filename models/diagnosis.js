import mongoose from "mongoose";

const DiagnosisSchema = new mongoose.Schema(
  {
    code: { type: String },
    name: { type: String, required: true },
    displayName: { type: String, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);
const TestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    availableInMedicalCenter: {
      type: Boolean,
      default: false, // true if this test is offered in Medical Center
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Diagnosis = mongoose.model("Diagnosis", DiagnosisSchema);
export const Test = mongoose.model("Test", TestSchema);

