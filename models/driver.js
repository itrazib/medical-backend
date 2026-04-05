import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: false, // you can make it required if you prefer
    },
  },
  {
    timestamps: true,
  }
);
const assignmentSchema = new mongoose.Schema({
  month: { type: Date, required: true, unique: true }, // store 1st of month
  drivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Driver" }],
});

export const AmbulanceAssignment = mongoose.model(
  "AmbulanceAssignment",
  assignmentSchema
);

export const Driver = mongoose.model("Driver", driverSchema);


