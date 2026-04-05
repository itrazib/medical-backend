import mongoose from "mongoose";

const DiagnosisSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // e.g. “I10” for hypertension
    name: { type: String, required: true }, // e.g. “Hypertension”
    notes: { type: String }, // optional description
  },
  { timestamps: true }
);
const PrescriptionDiagnosisSchema = new mongoose.Schema(
  {
    diagnosis: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Diagnosis",
      default: null,
    },
    displayName: { type: String, required: true },
  },
  { _id: false }
);
const PrescriptionTestSchema = new mongoose.Schema(
  {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);
// Counter for prescription numbers
const CounterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", CounterSchema);

const PrescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: {
      type: String,
      unique: true,
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalUser",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalUser",
      required: true,
    },
    date: { type: Date, default: Date.now },
    // Allows saving either a ref or custom name
    diagnoses: [PrescriptionDiagnosisSchema],

    // Allows saving either a ref or custom name for tests
    tests: [PrescriptionTestSchema],
    age: { type: Number },
    followUpDate: { type: Date },
    advice: { type: String },

    medicines: [
      {
        medicine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicine",
        },
        medicineName: String, //if user input it manually
        dose: String,
        frequency: String,
        startDate: Date,
        duration: String,
        requestedQuantity: {
          // total quantity doctor prescribed
          type: Number,
          required: true,
          min: [1, "Requested quantity must be at least 1"],
        },
        internalQuantity: {
          // quantity pharmacy will provide
          type: Number,
          default: 0,
          min: [0, "Cannot provide negative quantity"],
        },
        // externalQuantity can be derived or stored explicitly:
        externalQuantity: {
          // quantity patient must buy externally
          type: Number,
          default: 0,
          min: [0, "Cannot be negative"],
        },
        comments: String,
        dispensedFrom: {
          type: String,
          enum: ["internal", "external"],
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

// Automatically compute externalQuantity before saving
PrescriptionSchema.pre("validate", async function (next) {
  if (this.isNew && !this.prescriptionNumber) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "prescriptionNumber" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const datePart = this.date.toISOString().slice(0, 10).replace(/-/g, "");
    const seqPart = String(counter.seq).padStart(4, "0");
    this.prescriptionNumber = `RX-${datePart}-${seqPart}`;
  }
  next();
});

const Prescription = mongoose.model("Prescription", PrescriptionSchema);

export default Prescription;

