// === models/admin.js ===
import mongoose from "mongoose";

const universityDBAdminSchema = new mongoose.Schema(
  {
    uniqueId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "university-admin",
    },
  },
  { timestamps: true }
);

const medicalDBAdminSchema = new mongoose.Schema(
  {
    uniqueId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "medical-admin",
    },
  },
  { timestamps: true }
);

export const UniversityDBAdmin = mongoose.model(
  "UniversityDBAdmin",
  universityDBAdminSchema
);
export const MedicalDBAdmin = mongoose.model(
  "MedicalDBAdmin",
  medicalDBAdminSchema
);