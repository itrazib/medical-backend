import mongoose from "mongoose";

const MedicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // Brand name
    genericName: { type: String, required: true }, // Formula name
    type: {
      type: String,
      enum: [
        "Tablet",
        "Capsule",
        "Syrup",
        "Injection",
        "Ointment",
        "Eye Drops",
        "Powder",
        "Gel",
        "Lotion",
        "Other",
      ],
      required: true,
    },
    mainStockQuantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be less than 0"],
    },
    monthlyStockQuantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be less than 0"],
    },
    dosage: { type: String },
    manufacturer: { type: String },
    expiryDate: { type: Date },
    batchNumber: { type: String },
    price: { type: Number },

    storageCondition: { type: String },
    sideEffects: [{ type: String }],
    usageInstructions: { type: String },
  },
  { timestamps: true }
);

MedicineSchema.index({ name: "text", genericName: "text", dosage: "text" });

const Medicine = mongoose.model("Medicine", MedicineSchema);
export default Medicine;

