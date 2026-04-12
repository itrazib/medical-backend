// routes/medicalAdminRoutes.js
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import MedicalUser from "../models/medicalUser.js";
import DutyRosterDoctor from "../models/dutyRosterDoctor.js";
import DutyRoster from "../models/dutyRoster.js";
import TelemedicineDuty from "../models/telemedicineDuty.js";
import { AmbulanceAssignment, Driver } from "../models/driver.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

const isMedicalAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === "medical-admin") return next();
  return res.status(403).send("Access denied");
};

// Normalize department strings
function normalizeDept(dept) {
  return dept ? dept.trim().toLowerCase() : null;
}

// Helper: parse "YYYY-MM" → 1st day of month
function parseMonth(str) {
  const [year, mon] = str.split("-").map((n) => parseInt(n, 10));
  return new Date(year, mon - 1, 1);
}

// ------------------------ Doctor Duty Roster ------------------------
router.get("/duty-roster-doctor", isMedicalAdmin, async (req, res) => {
  try {
    const dutyRosterDoctor = await DutyRosterDoctor.find().populate("doctor");
    const doctors = await MedicalUser.find({ role: "doctor" });
    res.json({ dutyRosterDoctor, doctors });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/duty-roster-doctor/add", isMedicalAdmin, async (req, res) => {
  try {
    const { doctor, day, shift, startTime, endTime } = req.body;
    const exists = await DutyRosterDoctor.findOne({ doctor, day, shift });
    if (exists) return res.status(400).json({ error: "Doctor already scheduled for this day & shift." });

    const newDuty = await DutyRosterDoctor.create({ doctor, day, shift, startTime, endTime });
    await newDuty.populate("doctor");
    res.json(newDuty);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/duty-roster-doctor/delete/:id", isMedicalAdmin, async (req, res) => {
  try {
    await DutyRosterDoctor.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ------------------------ Staff Duty Roster ------------------------
router.get("/duty-roster",  async (req, res) => {
  try {
    let { department } = req.query;
    if (!department) return res.status(400).json({ error: "Department is required" });
    department = normalizeDept(department);

    const duties = await DutyRoster.find({ department }).populate("staff", "_id name department");
    res.json(duties);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/medical-users", isMedicalAdmin, async (req, res) => {
  try {
    let { department } = req.query;
    if (!department) return res.status(400).json({ error: "Department is required" });
    department = normalizeDept(department);

    const staff = await MedicalUser.find({ userType: "staff", department }).select("_id name department");
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/duty-roster/add", isMedicalAdmin, async (req, res) => {
  try {
    let { staff, department, day, shift, startTime, endTime } = req.body;
    if (!staff || !department || !day || !shift || !startTime || !endTime)
      return res.status(400).json({ error: "Missing required fields" });
    if (!mongoose.Types.ObjectId.isValid(staff))
      return res.status(400).json({ error: "Invalid staff ID" });

    department = normalizeDept(department);
    const exists = await DutyRoster.findOne({ staff, day, shift });
    if (exists) return res.status(400).json({ error: "Staff already scheduled for this day & shift" });

    const newDuty = await DutyRoster.create({ staff, department, day, shift, startTime, endTime });
    await newDuty.populate("staff", "_id name department");
    res.json(newDuty);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/duty-roster/delete/:id", isMedicalAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid duty record ID" });

    await DutyRoster.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------ Telemedicine Duties ------------------------
router.get("/telemedicine-duty", async (req, res) => {
  try {
    const duties = await TelemedicineDuty.find().populate("doctor", "name phone").sort({ day: 1 });
    const doctors = await MedicalUser.find({ role: "doctor" }).select("name phone");
    res.json({ duties, doctors });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch duties" });
  }
});

router.post("/telemedicine-duty/add", isMedicalAdmin, async (req, res) => {
  const { day, doctor } = req.body;
  try {
    const exists = await TelemedicineDuty.findOne({ day, doctor });
    if (exists) return res.status(400).json({ error: "Doctor already assigned for this day" });

    const newDuty = await TelemedicineDuty.create({ day, doctor });
    const populated = await newDuty.populate("doctor");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign duty" });
  }
});

router.post("/telemedicine-duty/delete/:id", isMedicalAdmin, async (req, res) => {
  try {
    await TelemedicineDuty.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove duty" });
  }
});

// ------------------------ Ambulance Drivers ------------------------
router.get("/get-drivers", isMedicalAdmin, async (req, res) => {
  try {
    const drivers = await Driver.find().sort("name");
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/current-driver", isMedicalAdmin, async (req, res) => {
  try {
    const monthParam = req.query.month || new Date().toISOString().slice(0, 7);
    const monthDate = parseMonth(monthParam);
    const assignment = await AmbulanceAssignment.findOne({ month: monthDate }).populate("drivers");
    res.json({ drivers: assignment ? assignment.drivers : [] });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/assign-driver", isMedicalAdmin, async (req, res) => {
  try {
    const monthDate = parseMonth(req.body.month);
    const driverIds = req.body.driverIds || [];

    if (!driverIds.length) {
      await AmbulanceAssignment.deleteOne({ month: monthDate });
      return res.json({ cleared: true });
    }

    let assign = await AmbulanceAssignment.findOne({ month: monthDate });
    if (assign) assign.drivers = driverIds;
    else assign = new AmbulanceAssignment({ month: monthDate, drivers: driverIds });

    await assign.save();
    const full = await assign.populate("drivers");
    res.json({ cleared: false, drivers: full.drivers });
  } catch (err) {
    res.status(500).json({ error: "Assignment failed" });
  }
});

export default router;