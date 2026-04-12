// routes/patientPrescription.js
import express from "express";
// import session from "express-session";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// import { GetObjectCommand, GetObjectAclCommand } from "@aws-sdk/client-s3";

// import s3Client from "../config/awsConfig.js";
// import MedicalUser from "../models/medicalUser.js";
// import Prescription from "../models/prescription.js";
import prescriptionController from "../controllers/prescriptionController.js";

const router = express.Router();

// Middleware to check if user is a patient
const isPatient = (req, res, next) => {
  if (req.session.user && req.session.user.role === "patient") {
    return next();
  }
  return res.status(403).send("Access denied");
};

// Patient prescription history route
router.get(
  "/prescription-history/:id",
  isPatient,
  prescriptionController.getPrescriptionHistory
);

export default router;