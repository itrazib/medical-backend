// === controllers/prescriptionController.js ===
import "dotenv/config";

import mongoose from "mongoose";
import MedicalUser from "../models/medicalUser.js";
import Medicine from "../models/medicine.js";
import Prescription from "../models/prescription.js";
import { Diagnosis, Test } from "../models/diagnosis.js";
import DispenseRecord from "../models/dispenseRecord.js";
import { calculateAge } from "../helper/prescriptionMethods.js";

// ==========================
// Get patient info by uniqueId
// ==========================
export const getPatientInfo = async (req, res) => {
  try {
    const patient = await MedicalUser.findOne({
      uniqueId: req.params.uniqueId.toLowerCase(),
    }).lean();

    if (!patient)
      return res.status(404).json({ message: "Patient not found" });

    patient.age = calculateAge(patient.dob);
    res.status(200).json({ patient });
  } catch (err) {
    console.error("Error fetching patient:", err);
    res.status(500).json({ message: "Server error fetching patient" });
  }
};

// ==========================
// List Diagnoses with optional search
// ==========================
export const listDiagnoses = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const regex = new RegExp(search.trim(), "i");

    const list = await Diagnosis.find({
      $or: [{ name: regex }, { displayName: regex }],
    })
      .sort({ displayName: 1 })
      .limit(50)
      .lean();

    res.json(list);
  } catch (err) {
    console.error("Error listing diagnoses:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Create new Diagnosis
// ==========================
export const createDiagnosis = async (req, res) => {
  try {
    const { code, name, displayName, notes } = req.body;
    if (!name || !displayName)
      return res
        .status(400)
        .json({ error: "name and displayName are required" });

    const diag = new Diagnosis({ code, name, displayName, notes });
    await diag.save();
    res.status(201).json(diag);
  } catch (err) {
    console.error("Error creating diagnosis:", err);
    if (err.code === 11000)
      return res
        .status(409)
        .json({ error: "Diagnosis code or name must be unique" });
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Get medicines (searchable)
// ==========================
export const getMedicine = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const regex = new RegExp(search.trim(), "i");

    const meds = await Medicine.find({
      $or: [{ name: regex }, { genericName: regex }, { dosage: regex }],
    })
      .select("name genericName dosage monthlyStockQuantity _id")
      .limit(50)
      .lean();

    res.json(meds);
  } catch (err) {
    console.error("Error fetching medicines:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Get Tests (searchable)
// ==========================
export const getTests = async (req, res) => {
  try {
    const searchTerm = req.query.search || "";
    const regex = new RegExp(searchTerm, "i");

    const tests = await Test.find({ $or: [{ name: regex }, { code: regex }] })
      .limit(20)
      .lean();

    res.json(tests);
  } catch (err) {
    console.error("Error fetching tests:", err);
    res.status(500).json({ message: "Server error fetching tests" });
  }
};

// ==========================
// Create Test
// ==========================
export const postTests = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: "Test name is required" });

    const newTest = new Test({ name });
    const saved = await newTest.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Error creating test:", err);
    if (err.code === 11000)
      return res.status(400).json({ message: "Test already exists" });
    res.status(500).json({ message: "Server error creating test" });
  }
};

// ==========================
// Create Prescription
// ==========================
export const postPrescription = async (req, res) => {
  try {
    const {
      patient,
      doctor,
      date = new Date(),
      diagnoses = [],
      tests = [],
      age,
      followUpDate,
      advice = "",
      medicines = [],
    } = req.body;

    const prescriptionMeds = medicines.map((m) => {
      const requested = parseInt(m.requestedQuantity, 10) || 0;
      const internalQ =
        m.dispensedFrom === "internal"
          ? parseInt(m.internalQuantity, 10) || 0
          : 0;
      return {
        medicine: m.medicine || null,
        medicineName: m.medicineName,
        dose: m.dose || "",
        frequency: m.frequency,
        startDate: m.startDate ? new Date(m.startDate) : date,
        duration: String(m.durationDays || ""),
        requestedQuantity: requested,
        internalQuantity: internalQ,
        externalQuantity: requested - internalQ,
        comments: m.comments || "",
        dispensedFrom: m.dispensedFrom,
      };
    });

    const prescription = new Prescription({
      patient,
      doctor,
      date,
      diagnoses,
      tests,
      age,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      advice,
      medicines: prescriptionMeds,
    });
    await prescription.save();

    let dispenseRecord = null;
    const internalMeds = prescription.medicines.filter(
      (m) => m.dispensedFrom === "internal"
    );

    if (internalMeds.length > 0) {
      const dispenseItems = internalMeds.map((m) => ({
        medicine: m.medicine,
        quantity: m.internalQuantity,
        status: "pending",
      }));

      dispenseRecord = new DispenseRecord({
        prescription: prescription._id,
        patient,
        doctor,
        pharmacyStaff: null,
        medicines: dispenseItems,
        overallStatus: "pending",
      });

      await dispenseRecord.save();

      // Emit socket event
      const io = req.app.get("io");
      io?.emit("new-dispense-request", {
        recordId: dispenseRecord._id,
        patient,
      });
    }

    res.status(201).json({ prescription, dispenseRecord });
  } catch (err) {
    console.error("Error creating prescription:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Get Prescription by ID with its dispense record
// ==========================
export const getPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(prescriptionId))
      return res.status(400).json({ error: "Invalid prescription ID" });

    const prescription = await Prescription.findById(prescriptionId)
      .populate("patient", "name sex uniqueId")
      .populate("doctor", "name uniqueId")
      .populate("diagnoses", "displayName name")
      .populate("tests", "name code")
      .lean();

    if (!prescription)
      return res.status(404).json({ error: "Prescription not found" });

    let dispenseRecord = await DispenseRecord.findOne({
      prescription: prescriptionId,
    })
      .select("medicines overallStatus pharmacyStaff dispensedAt")
      .populate("medicines.medicine", "name")
      .lean();

    if (dispenseRecord) {
      dispenseRecord.medicines = dispenseRecord.medicines.map((item) => ({
        ...item,
        medicineName: item.medicine?.name,
      }));
    }

    res.json({ prescription, dispenseRecord });
  } catch (err) {
    console.error("Error fetching prescription:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Get Prescription history for a patient
// ==========================
export const getPrescriptionHistory = async (req, res) => {
  try {
    const patientId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(patientId))
      return res.status(400).json({ error: "Invalid patient ID" });

    const prescriptions = await Prescription.find({ patient: patientId })
      .sort({ date: -1 })
      .limit(50)
      .populate("doctor", "name")
      .lean();

    res.json({ prescriptions });
  } catch (err) {
    console.error("Error fetching prescription history:", err);
    res.status(500).json({ message: "Server error" });
  }
};
export default {
    getPatientInfo,
    listDiagnoses,
    createDiagnosis,
    getMedicine,
    getTests,
    postTests,
    postPrescription,
    getPrescription,
    getPrescriptionHistory,
};