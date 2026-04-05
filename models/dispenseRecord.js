import mongoose from "mongoose";

const DispensedItemSchema = new mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Medicine",
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, "Quantity must be non-negative"],
  },
  status: {
    type: String,
    enum: ["pending", "dispensed"],
    default: "pending",
  },
});

const DispenseRecordSchema = new mongoose.Schema(
  {
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalUser",
      required: true,
    },
    pharmacyStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalUser",
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalUser",
    },
    dispensedAt: { type: Date },
    medicines: [DispensedItemSchema],
    overallStatus: {
      type: String,
      enum: ["pending", "partial", "completed"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

const DispenseRecord = mongoose.model("DispenseRecord", DispenseRecordSchema);
export default DispenseRecord;
