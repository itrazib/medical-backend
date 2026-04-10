// routes/userRoutes.js
import "dotenv/config";
import express from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import MedicalUser from "../models/medicalUser.js";
import DutyRosterDoctor from "../models/dutyRosterDoctor.js";
import TimeSlot from "../models/timeSlot.js";
import TelemedicineDuty from "../models/telemedicineDuty.js";
import { Test } from "../models/diagnosis.js";
import DutyRoster from "../models/dutyRoster.js";
import { AmbulanceAssignment } from "../models/driver.js";
import s3Client from "../config/awsConfig.js";

const router = express.Router();

router.get("/whoami", async (req, res) => {
  console.log("=== WHOAMI ROUTE HIT ===");
  console.log("Cookies:", req.cookies);
  console.log("Session:", req.session.user);
  if (req.session && req.session.user) {
    return res.json(req.session.user);
  } else {
    return res.json(null);
  }
});

router.get("/profile/:id", async (req, res) => {
  try {
    const user = await MedicalUser.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.photo) {
      user.photoUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: user.photo,
        })
      );
    } else {
      user.photoUrl = null;
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/doctors", async (req, res) => {
  try {
    const doctors = await MedicalUser.find({ role: "doctor" }).lean();
    if (!doctors.length) return res.status(404).json({ message: "doctors not found", patient: null });

    for (let doctor of doctors) {
      if (doctor.photo) {
        doctor.photoUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: doctor.photo,
          })
        );
      } else doctor.photoUrl = null;
    }

    res.json({ doctors, message: "doctors found successfully" });
  } catch (err) {
    res.status(500).json({ message: "An error occurred while searching for the patient", error: err.message });
  }
});

router.get("/medical-staff", async (req, res) => {
  try {
    const staff = await MedicalUser.find({ role: "medical-staff" }).lean();
    if (!staff.length) return res.status(404).json({ message: "No medical staff found", staff: null });

    for (let member of staff) {
      if (member.photo) {
        member.photoUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: member.photo,
          })
        );
      } else member.photoUrl = null;
    }

    res.json({ staff, message: "Medical staff found successfully" });
  } catch (err) {
    res.status(500).json({ message: "An error occurred while fetching medical staff", error: err.message });
  }
});

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

router.get("/doctor-list", async (req, res) => {
  try {
    const dutyRosterDoctor = await DutyRosterDoctor.find().populate("doctor");
    res.json(dutyRosterDoctor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/telemedicine-duty", async (req, res) => {
  try {
    const duties = await TelemedicineDuty.find({})
      .populate({ path: "doctor", select: "name phone role", match: { role: "doctor" } })
      .lean();

    const filteredDuties = duties.filter((duty) => duty.doctor);

    const responseDuties = filteredDuties.map(({ day, doctor }) => ({
      day,
      doctor: { name: doctor.name, phone: doctor.phone },
    }));

    res.json({ duties: responseDuties });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/telemedicine/doctors-today", async (req, res) => {
  try {
    const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const today = weekdays[new Date().getDay()];

    const duties = await TelemedicineDuty.find({ day: today }).populate({
      path: "doctor",
      select: "name phone role",
      match: { role: "doctor" },
    });

    const doctors = duties.map((duty) => duty.doctor).filter(Boolean);
    res.json({ success: true, doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/pathology-tests", async (req, res) => {
  try {
    const tests = await Test.find({ availableInMedicalCenter: false });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

function parseMonth(str) {
  const [year, mon] = str.split("-").map((n) => parseInt(n, 10));
  return new Date(year, mon - 1, 1);
}

router.get("/ambulance/current-driver", async (req, res) => {
  try {
    const monthParam = req.query.month || new Date().toISOString().slice(0, 7);
    const monthDate = parseMonth(monthParam);
    const assignment = await AmbulanceAssignment.findOne({ month: monthDate }).populate("drivers");
    res.json({ drivers: assignment ? assignment.drivers : [] });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/departments", async (req, res) => {
  try {
    const departments = await DutyRoster.distinct("department");
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching departments" });
  }
});

router.get("/staff/:department", async (req, res) => {
  try {
    const staffIds = await DutyRoster.find({ department: req.params.department }).distinct("staff");
    const staff = await MedicalUser.find({ _id: { $in: staffIds } }).select("name role");
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching staff" });
  }
});

router.get("/roster/:department", async (req, res) => {
  try {
    const rosters = await DutyRoster.find({ department: req.params.department }).populate("staff", "name");
    const grouped = {};
    rosters.forEach((r) => {
      if (!grouped[r.day]) grouped[r.day] = {};
      if (!grouped[r.day][r.shift]) grouped[r.day][r.shift] = [];
      grouped[r.day][r.shift].push(r.staff.name);
    });
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching roster" });
  }
});

export default router;