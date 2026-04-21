// routes/prescriptionRoutes.js
import "dotenv/config";
import express from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import MedicalUser from "../models/medicalUser.js";
import Medicine from "../models/medicine.js";
import Prescription from "../models/prescription.js";
import { createDiagnosis, getMedicine, getPatientInfo, getPrescription, getTests, listDiagnoses, postPrescription, postTests } from "../controllers/prescriptionController.js";
import { getSingleMedicine } from "../controllers/medicineController.js";
import { getAvailableDoctors } from "../controllers/doctorController.js";



const router = express.Router();

const isDoctor = (req, res, next) => {
  if (req.session.user && req.session.user.role === "doctor") {
    return next();
  }
  return res.status(403).send("Access denied");
};

// Search patient
router.get("/search-patient", isDoctor, async (req, res) => {
  const query = req.query.patient;
  try {
    const patients = query
      ? await MedicalUser.find({
          $and: [
            {
              $or: [
                { uniqueId: { $regex: query.toString(), $options: "i" } },
                { name: { $regex: query.toString(), $options: "i" } },
              ],
            },
            { role: { $ne: "doctor" } },
          ],
        })
      : [];

    if (!patients.length) {
      return res.status(404).json({ message: "Patient not found", patient: null });
    }

    for (let patient of patients) {
      patient.photoUrl = patient.photo
        ? await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: patient.photo,
            })
          )
        : null;
    }

    res.json({ patients, message: "Patients found successfully" });
  } catch (err) {
    res.status(500).json({ message: "An error occurred while searching for the patient", error: err.message });
  }
});

// Get patient profile
router.get("/patient-profile/:uniqueId", isDoctor, async (req, res) => {
  const { uniqueId } = req.params;

  try {
    const patient = await MedicalUser.findOne({
      uniqueId,
      role: { $ne: "doctor" },
    }).lean();

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // ✅ DB direct URL use
    patient.photoUrl = patient.photo || null;

    res.json({
      success: true,
      user: patient,
      message: "Patient profile fetched successfully",
    });
  } catch (err) {
    // console.error("Error fetching patient:", err);

    res.status(500).json({
      message: "Server error while fetching patient profile",
      error: err.message,
    });
  }
});

// Prescription routes
router.get("/pres/patient-profile/:uniqueId", getPatientInfo);
router.get("/diagnoses", listDiagnoses);
router.post("/diagnoses", createDiagnosis);
router.get("/pres/medicines", getMedicine);
router.post("/create-prescription", postPrescription);
router.get("/show-prescription/:prescriptionId", getPrescription);
router.get("/tests", getTests);
router.post("/tests", postTests);

// Search medicine
router.get("/search-medicine", isDoctor, async (req, res) => {
  try {
    const query = req.query.medicine || "";
    const medicines = query
      ? await Medicine.find({
          $or: [
            { name: { $regex: query.toString(), $options: "i" } },
            { genericName: { $regex: query.toString(), $options: "i" } },
            { manufacturer: { $regex: query.toString(), $options: "i" } },
          ],
        })
      : [];

    if (!medicines.length) return res.status(404).json({ message: "medicines not found", medicines: null });

    res.json({ medicines, message: "medicines found successfully" });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
});

router.get("/medicine/:medicineId", async (req, res) => {
  const { medicineId } = req.params;
  try {
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });
    res.json(medicine);
  } catch (err) {
    res.status(500).json({ message: "Error fetching medicine data" });
  }
});

router.get("/medicines", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { search, type } = req.query;

    const query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ name: { $regex: regex } }, { genericName: { $regex: regex } }];
    }
    if (type) query.type = type;

    const skip = (page - 1) * limit;
    const medicines = await Medicine.find(query)
      .select("-mainStockQuantity")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);
    const totalCount = await Medicine.countDocuments(query);

    res.json({ success: true, medicines, page, limit, totalCount });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/medicines/:id", getSingleMedicine);

// Combined search
router.get("/search", async (req, res) => {
  const query = (req.query.q || "").trim();
  if (!query) return res.json({ results: [] });

  const regex = new RegExp(query, "i");

  try {
    const [patients, medicines] = await Promise.all([
      MedicalUser.find({ role: "patient", $or: [{ name: regex }, { uniqueId: regex }] }).limit(10).lean(),
      Medicine.find({ $or: [{ name: regex }, { genericName: regex }, { manufacturer: regex }] }).limit(10).lean(),
    ]);

    const patientResults = patients.map((u) => ({ type: "patient", name: u.name, uniqueId: u.uniqueId, _id: u._id }));
    const medicineResults = medicines.map((m) => ({
      type: "medicine",
      name: m.name,
      genericName: m.genericName,
      manufacturer: m.manufacturer,
      _id: m._id,
    }));

    res.json({ results: [...patientResults, ...medicineResults] });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Patient history
router.get("/patient-history/:uniqueId", isDoctor, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const patient = await MedicalUser.findOne({ uniqueId }).select("_id");
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    const prescriptions = await Prescription.find({ patient: patient._id })
      .sort({ createdAt: -1 })
      .populate("doctor", "name uniqueId")
      .lean();

    res.json({ success: true, prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/available", getAvailableDoctors);

// My prescriptions
router.get("/my-prescriptions/:id", isDoctor, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctor: req.params.id })
      .sort({ createdAt: -1 })
      .populate("patient", "name uniqueId");
    res.json({ success: true, prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;