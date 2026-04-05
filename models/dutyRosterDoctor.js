// backend/models/dutyRosterDoctor.js
import mongoose from "mongoose";
import MedicalUser from "./medicalUser.js"; // ✅ default import

const DutyRosterDoctorSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalUser",
      required: true,
    },
    day: {
      type: String,
      enum: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      required: true,
    },
    shift: {
      type: String,
      enum: ["Morning", "Evening", "Full Day"],
      required: true,
    },
    startTime: {
      type: String, // "08:00" format
      required: true,
    },
    endTime: {
      type: String, // "16:00" format
      required: true,
    },
    telemedicineDay: {
      type: Boolean,
      default: false, // optional field
    },
  },
  {
    timestamps: true, // createdAt, updatedAt auto
  }
);

// Prevent duplicate doctor/day/shift
DutyRosterDoctorSchema.index(
  { doctor: 1, day: 1, shift: 1 },
  { unique: true, name: "unique_doctor_day_shift" }
);

const DutyRosterDoctor = mongoose.model("DutyRosterDoctor", DutyRosterDoctorSchema);
export default DutyRosterDoctor;