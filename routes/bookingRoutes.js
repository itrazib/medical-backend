// === routes/bookingRoutes.js ===
import "dotenv/config";
import express from "express";
import { DateTime } from "luxon";

import MedicalUser from "../models/medicalUser.js";
import DutyRosterDoctor from "../models/dutyRosterDoctor.js";
import { TimeSlot, DoctorDayOff } from "../models/timeSlot.js";
import { generateTimeSlots, convertToMinutes } from "../helper/bookingMethods.js";

const router = express.Router();

// GET all doctors
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await MedicalUser.find({ role: "doctor" }).lean();
    if (!doctors.length)
      return res.status(404).json({ message: "doctors not found", patient: null });
    return res.json({ doctors });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "An error occurred while fetching doctors", error: err.message });
  }
});

// POST mark day off
router.post("/day-off", async (req, res) => {
  try {
    const { doctorId, date, reason } = req.body;
    if (!doctorId || !date)
      return res.status(400).json({ message: "doctorId and date required" });

    const day = DateTime.fromISO(date).startOf("day").toJSDate();
    const off = await DoctorDayOff.findOneAndUpdate(
      { doctor: doctorId, date: day },
      { reason },
      { upsert: true, new: true }
    );
    res.json({ message: "Day off set", off });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error setting day off", error: err.message });
  }
});

// GET available doctors on a day
router.get("/available-doctors", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });

    const selectedDate = DateTime.fromISO(date).setZone("Asia/Dhaka");
    const dayOfWeek = selectedDate.toFormat("cccc");

    const roster = await DutyRosterDoctor.find({ day: dayOfWeek }).populate("doctor");
    res.json({ availableDoctors: roster });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET time slots for a doctor on a date
router.get("/slots", async (req, res) => {
  try {
    const { doctor: doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: "doctor and date required" });

    const selectedDate = DateTime.fromISO(date, { zone: "Asia/Dhaka" }).startOf("day");
    const baseDate = selectedDate.toJSDate();
    const dayOfWeek = selectedDate.toFormat("cccc");
    const today = DateTime.local().setZone("Asia/Dhaka");
    const isToday = selectedDate.hasSame(today, "day");

    // Check full day off
    const offRecord = await DoctorDayOff.findOne({ doctor: doctorId, date: baseDate });
    if (offRecord) return res.json({ message: "Doctor is off for the day", slots: [] });

    const doctor = await MedicalUser.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    const rosterEntry = await DutyRosterDoctor.findOne({ doctor: doctorId, day: dayOfWeek });
    if (!rosterEntry) return res.status(404).json({ message: "Doctor is not on duty that day" });

    let times = generateTimeSlots(rosterEntry.startTime, rosterEntry.endTime, 10, baseDate);
    times.sort((a, b) => convertToMinutes(a) - convertToMinutes(b));

    const slots = await Promise.all(
      times.map(async (timeStr, idx) => {
        let slot = await TimeSlot.findOne({ doctor: doctorId, date, time: timeStr });
        if (!slot) {
          slot = new TimeSlot({ doctor: doctorId, date, time: timeStr, queueNumber: idx + 1 });
          await slot.save();
        }

        const slotDT = DateTime.fromFormat(`${date} ${timeStr}`, "yyyy-MM-dd h:mm a", { zone: "Asia/Dhaka" });
        if (isToday && slotDT < today && slot.status === "available") {
          slot.status = "unavailable";
          await slot.save();
        }

        await slot.populate("bookedBy", "uniqueId name");

        return {
          _id: slot._id,
          time: slot.time,
          status: slot.status,
          bookingStatus: slot.bookingStatus,
          bookedBy: slot.bookedBy ? { id: slot.bookedBy._id, uniqueId: slot.bookedBy.uniqueId, name: slot.bookedBy.name } : null,
          queueNumber: slot.queueNumber,
        };
      })
    );

    res.json(slots);
  } catch (err) {
    console.error("Error in /booking/slots:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST book a slot
router.post("/book/:slotId", async (req, res) => {
  const { slotId } = req.params;
  const { patientId, date } = req.body;

  try {
    const existingBooking = await TimeSlot.findOne({ bookedBy: patientId, date, bookingStatus: "booked" });
    if (existingBooking) return res.status(400).json({ message: "You have already booked a slot for this day." });

    const slot = await TimeSlot.findById(slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    if (slot.bookingStatus === "booked") return res.status(400).json({ message: "Slot already booked" });

    slot.status = "unavailable";
    slot.bookingStatus = "booked";
    slot.bookedBy = patientId;
    await slot.save();
    await slot.populate("bookedBy", "uniqueId name");

    const returned = {
      _id: slot._id,
      time: slot.time,
      status: slot.status,
      bookingStatus: slot.bookingStatus,
      bookedBy: { id: slot.bookedBy._id, uniqueId: slot.bookedBy.uniqueId, name: slot.bookedBy.name },
      queueNumber: slot.queueNumber,
    };

    res.json({ message: "Booked", slot: returned });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error booking the slot", error: error.message });
  }
});

// POST cancel a booking
router.post("/cancel/:slotId", async (req, res) => {
  const { slotId } = req.params;
  try {
    const slot = await TimeSlot.findById(slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    slot.status = "available";
    slot.bookingStatus = "";
    slot.bookedBy = null;
    await slot.save();

    res.json({
      message: "Booking canceled successfully",
      slot: { _id: slot._id, time: slot.time, status: slot.status, bookingStatus: slot.bookingStatus, bookedBy: null, queueNumber: slot.queueNumber },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error canceling the booking", error: error.message });
  }
});

// POST mark slot unavailable (admin)
router.post("/unavailable/:slotId", async (req, res) => {
  const { slotId } = req.params;
  try {
    const slot = await TimeSlot.findById(slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    slot.status = "unavailable";
    await slot.save();
    await slot.populate("bookedBy", "uniqueId name");

    res.json({
      message: "Slot set unavailable",
      slot: { _id: slot._id, time: slot.time, status: slot.status, bookingStatus: slot.bookingStatus, bookedBy: slot.bookedBy ? { id: slot.bookedBy._id, uniqueId: slot.bookedBy.uniqueId, name: slot.bookedBy.name } : null, queueNumber: slot.queueNumber },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error setting unavailable", error: err.message });
  }
});

// POST mark slot as seen
router.post("/mark-seen/:slotId", async (req, res) => {
  const { slotId } = req.params;
  try {
    const slot = await TimeSlot.findById(slotId);
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    slot.status = "seen";
    await slot.save();
    res.json({ slot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;