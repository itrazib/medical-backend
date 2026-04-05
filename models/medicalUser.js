// backend/models/medicalUser.js
import mongoose from "mongoose";

// Role determination logic
function determineRole(userType, designation, office) {
  const lowerDesignation = (designation || "").toLowerCase();
  const lowerOffice = (office || "").toLowerCase();

  if (userType === "student" || userType === "teacher") return "patient";
  if (lowerDesignation.includes("doctor") || lowerDesignation.includes("medical officer")) return "doctor";
  if (lowerOffice.includes("medical center")) return "medical-staff";
  return "patient";
}

const medicalUserSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  userType: { type: String, enum: ["student", "teacher", "staff"], required: true },
  sex: { type: String, enum: ["male", "female"], required: true },
  department: { type: String },
  program: { type: String, enum: ["graduate", "undergraduate", ""] },
  office: { type: String },
  designation: { type: String },
  designation_2: { type: String },
  hall: { type: String },
  session: { type: String },
  bloodGroup: { type: String },
  dob: { type: Date, required: true },
  emails: { type: [String], required: true },
  phone: { type: String, required: true },
  photo: { type: String },
  password: { type: String },
  role: { type: String, enum: ["patient", "doctor", "medical-staff", "admin"], required: true },
  googleId: { type: String, unique: true, sparse: true },
});

// Static method
medicalUserSchema.statics.determineRole = determineRole;

// Virtuals for prescriptions
medicalUserSchema.virtual("writtenPrescriptions", {
  ref: "Prescription",
  localField: "_id",
  foreignField: "doctor",
});
medicalUserSchema.virtual("receivedPrescriptions", {
  ref: "Prescription",
  localField: "_id",
  foreignField: "patient",
});

medicalUserSchema.set("toObject", { virtuals: true });
medicalUserSchema.set("toJSON", { virtuals: true });

// Default export
const MedicalUser = mongoose.model("MedicalUser", medicalUserSchema);
export default MedicalUser;