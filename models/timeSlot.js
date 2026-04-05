import mongoose from "mongoose";

const TimeSlotSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalUser",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true, // e.g., "08:30 AM"
  },
  status: {
    type: String,
    enum: ["available", "unavailable", "seen"],
    default: "available",
  },
  bookingStatus: {
    type: String,
    enum: ["booked", ""],
    default: "",
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalUser",
    default: null,
  },
  queueNumber: {
    type: Number,
  },
});

const DoctorDayOffSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalUser",
    required: true,
  },
  date: { type: Date, required: true },
  reason: { type: String, default: "Day off" },
});
DoctorDayOffSchema.index({ doctor: 1, date: 1 }, { unique: true });

export const DoctorDayOff = mongoose.model("DoctorDayOff", DoctorDayOffSchema);

export const TimeSlot = mongoose.model("TimeSlot", TimeSlotSchema);

export default { TimeSlot, DoctorDayOff };

