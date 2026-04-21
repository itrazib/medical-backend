import "dotenv/config";
import express from "express";

import MedicalUser from "../models/medicalUser.js";
import DutyRosterDoctor from "../models/dutyRosterDoctor.js";
import TelemedicineDuty from "../models/telemedicineDuty.js";
import { Test } from "../models/diagnosis.js";
import DutyRoster from "../models/dutyRoster.js";
import { AmbulanceAssignment } from "../models/driver.js";

const router = express.Router();

/* ---------------- WHOAMI ---------------- */
router.get("/whoami", async (req, res) => {
  if (req.session && req.session.user) {
    return res.json(req.session.user);
  }
  return res.json(null);
});

/* ---------------- PROFILE ---------------- */
router.get("/profile/:id", async (req, res) => {
  try {
    const user = await MedicalUser.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // 🔥 now photo is direct URL (no AWS)
    user.photoUrl = user.photo || null;

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- DOCTORS ---------------- */
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await MedicalUser.find({ role: "doctor" }).lean();

    if (!doctors.length) {
      return res.status(404).json({
        message: "doctors not found",
        doctors: [],
      });
    }

    const updated = doctors.map((doc) => ({
      ...doc,
      photoUrl: doc.photo || null,
    }));

    res.json({
      doctors: updated,
      message: "doctors found successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

/* ---------------- STAFF ---------------- */
router.get("/medical-staff", async (req, res) => {
  try {
    const staff = await MedicalUser.find({ role: "medical-staff" }).lean();

    if (!staff.length) {
      return res.status(404).json({
        message: "No medical staff found",
        staff: [],
      });
    }

    const updated = staff.map((m) => ({
      ...m,
      photoUrl: m.photo || null,
    }));

    res.json({
      staff: updated,
      message: "Medical staff found successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

/* ---------------- DUTY ROSTER DOCTOR ---------------- */
router.get("/duty-roster-doctor", async (req, res) => {
  try {
    const entries = await DutyRosterDoctor.find()
      .populate("doctor", "name")
      .sort({ day: 1, shift: 1, startTime: 1 });

    res.json({ dutyRosterDoctor: entries });
  } catch (err) {
    res.status(500).json({ message: "Server error loading roster" });
  }
});

/* ---------------- DOCTOR LIST ---------------- */
router.get("/doctor-list", async (req, res) => {
  try {
    const list = await DutyRosterDoctor.find().populate("doctor");
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- TELEMEDICINE DUTY ---------------- */
router.get("/telemedicine-duty", async (req, res) => {
  try {
    const duties = await TelemedicineDuty.find({})
      .populate({
        path: "doctor",
        select: "name phone role",
        match: { role: "doctor" },
      })
      .lean();

    const filtered = duties.filter((d) => d.doctor);

    const response = filtered.map((d) => ({
      day: d.day,
      doctor: {
        name: d.doctor.name,
        phone: d.doctor.phone,
      },
    }));

    res.json({ duties: response });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---------------- TODAY DOCTORS ---------------- */
router.get("/telemedicine/doctors-today", async (req, res) => {
  try {
    const days = [
      "Sunday","Monday","Tuesday","Wednesday",
      "Thursday","Friday","Saturday"
    ];

    const today = days[new Date().getDay()];

    const duties = await TelemedicineDuty.find({ day: today }).populate({
      path: "doctor",
      select: "name phone role",
      match: { role: "doctor" },
    });

    const doctors = duties.map((d) => d.doctor).filter(Boolean);

    res.json({ success: true, doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- TESTS ---------------- */
router.get("/pathology-tests", async (req, res) => {
  try {
    const tests = await Test.find({
      availableInMedicalCenter: true,
    });

    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- AMBULANCE ---------------- */
function parseMonth(str) {
  const [year, mon] = str.split("-").map(Number);
  return new Date(year, mon - 1, 1);
}

router.get("/ambulance/current-driver", async (req, res) => {
  try {
    const monthParam =
      req.query.month || new Date().toISOString().slice(0, 7);

    const monthDate = parseMonth(monthParam);

    const assignment = await AmbulanceAssignment
      .findOne({ month: monthDate })
      .populate("drivers");

    res.json({
      drivers: assignment ? assignment.drivers : [],
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- DEPARTMENTS ---------------- */
router.get("/departments", async (req, res) => {
  try {
    const departments = await DutyRoster.distinct("department");
    res.json(departments);
  } catch (error) {
    res.status(500).json({
      error: "Server error fetching departments",
    });
  }
});

/* ---------------- STAFF BY DEPT ---------------- */
router.get("/staff/:department", async (req, res) => {
  try {
    const staffIds = await DutyRoster.find({
      department: req.params.department,
    }).distinct("staff");

    const staff = await MedicalUser.find({
      _id: { $in: staffIds },
    }).select("name role");

    res.json(staff);
  } catch (error) {
    res.status(500).json({
      error: "Server error fetching staff",
    });
  }
});

/* ---------------- ROSTER ---------------- */
router.get("/roster/:department", async (req, res) => {
  try {
    const rosters = await DutyRoster.find({
      department: req.params.department,
    }).populate("staff", "name");

    const grouped = {};

    rosters.forEach((r) => {
      if (!grouped[r.day]) grouped[r.day] = {};
      if (!grouped[r.day][r.shift]) grouped[r.day][r.shift] = [];
      grouped[r.day][r.shift].push(r.staff.name);
    });

    res.json(grouped);
  } catch (error) {
    res.status(500).json({
      error: "Server error fetching roster",
    });
  }
});

export default router;