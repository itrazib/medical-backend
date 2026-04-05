import dotenv from "dotenv";
dotenv.config();

import express from "express";
const router = express.Router();

import authenticationRoutes from "./authenticationRoutes.js";
import medicalAdminRoutes from "./medicalAdminRoutes.js";
import universityAdminRoutes from "./universityAdminRoutes.js";
import doctorRoutes from "./doctorRoutes.js";
import patientRoutes from "./patientRoutes.js";
import medicalStaffRoutes from "./medicalStaffRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import commonRoutes from "./commonRoutes.js";

router.use("/admin/medical", medicalAdminRoutes);
router.use("/admin/university", universityAdminRoutes);
router.use("/doctor", doctorRoutes);
router.use("/patient", patientRoutes);
router.use("/medical-staff", medicalStaffRoutes);
router.use("/auth", authenticationRoutes);
router.use("/booking", bookingRoutes);
router.use("/api", commonRoutes);

router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default router;