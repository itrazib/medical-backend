import mongoose from "mongoose";

const DutyRosterSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalUser",
    required: true,
  },
  department: {
    // or role, or designation
    type: String,
    required: true,
  },
  day: {
    type: String,
    enum: [
      "Saturday",
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ],
    required: true,
  },
  shift: {
    type: String,
    enum: ["Morning", "Evening"],
    required: true,
  },
  startTime: { type: String, required: true }, // e.g. "8:00 am"
  endTime: { type: String, required: true }, // e.g. "2:00 pm"
  meta: { type: mongoose.Schema.Types.Mixed }, // for any special info (e.g., telemedicine)
});

DutyRosterSchema.index({ staff: 1, day: 1, shift: 1 }, { unique: true });

 const DutyRoster = mongoose.model("DutyRoster", DutyRosterSchema);
 export default DutyRoster;
