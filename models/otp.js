import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 120, //120 seconds - 2 minutes
  },
  retryCount: {
    type: Number,
    default: 0,
  },
});

const OtpModel = mongoose.model("OtpModel", otpSchema);
export default OtpModel;

