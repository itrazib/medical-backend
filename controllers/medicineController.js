// === controllers/medicineController.js ===
import Medicine from "../models/medicine.js";
import DispenseRecord from "../models/dispenseRecord.js";
import Prescription from "../models/prescription.js";

// ==========================
// List dispense requests with optional filters
// ==========================
export const getDispenseReq = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status && status !== "all") filter.overallStatus = status;

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const skip = (page - 1) * limit;
    const totalCount = await DispenseRecord.countDocuments(filter);
    res.set("X-Total-Count", totalCount);

    const records = await DispenseRecord.find(filter)
      .populate("patient", "name")
      .populate("doctor", "name")
      .populate({ path: "medicines.medicine", select: "name dosage" })
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json(records);
  } catch (err) {
    console.error("Error fetching dispense records:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ==========================
// Change dispense record status
// ==========================
export const changeStatus = async (req, res) => {
  try {
    const { overallStatus } = req.body;
    const record = await DispenseRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    record.overallStatus = overallStatus;
    await record.save();
    res.json({ record });
  } catch (err) {
    console.error("Error updating dispense record status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ==========================
// Finalize dispense request & update monthly stock
// ==========================
export const changeMonthlyStock = async (req, res) => {
  try {
    const record = await DispenseRecord.findById(req.params.id).populate(
      "medicines.medicine"
    );
    if (!record) return res.status(404).json({ error: "Record not found" });

    if (record.overallStatus !== "completed") {
      return res
        .status(400)
        .json({ error: "Can only finalize a completed request" });
    }

    if (req.session?.user?.id) {
      record.pharmacyStaff = req.session.user.id;
    }
    record.dispensedAt = new Date();
    await record.save();

    await Promise.all(
      record.medicines.map((item) => {
        const med = item.medicine;
        med.monthlyStockQuantity = Math.max(
          0,
          med.monthlyStockQuantity - item.quantity
        );
        return med.save();
      })
    );
    res.json({ message: "Stock updated and record finalized successfully" });
  } catch (err) {
    console.error("Error finalizing dispense record:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ==========================
// List medicines with search & pagination
// ==========================
export const getAllMedicine = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { name: regex },
        { genericName: regex },
        { manufacturer: regex },
        { dosage: regex },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const totalItems = await Medicine.countDocuments(query);
    const totalPages = Math.ceil(totalItems / Number(limit));
    const items = await Medicine.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ items, totalPages, totalItems });
  } catch (err) {
    console.error("Error listing medicines:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Get single medicine
// ==========================
export const getSingleMedicine = async (req, res) => {
  try {
    const med = await Medicine.findById(req.params.id);
    if (!med) return res.status(404).json({ error: "Medicine not found" });
    res.json(med);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Add / create / update / delete medicine
// ==========================
export const postSingleMedicine = async (req, res) => {
  try {
    const newMed = new Medicine(req.body);
    await newMed.save();
    res.status(201).json(newMed);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const updateMedicine = async (req, res) => {
  try {
    const updates = req.body;
    const med = await Medicine.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!med) return res.status(404).json({ error: "Medicine not found" });
    res.json(med);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const deleteMedicine = async (req, res) => {
  try {
    const med = await Medicine.findByIdAndDelete(req.params.id);
    if (!med) return res.status(404).json({ error: "Medicine not found" });
    res.json({ message: "Medicine deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Search medicines for suggestions
// ==========================
export const searchMedicine = async (req, res) => {
  try {
    const q = req.query.query || "";
    const regex = new RegExp(q, "i");
    const matched = await Medicine.find({
      $or: [{ name: regex }, { genericName: regex }, { manufacturer: regex }],
    }).limit(50);
    const suggestions = Array.from(
      new Set([
        ...matched.map((m) => m.name),
        ...matched.map((m) => m.genericName),
        ...matched.map((m) => m.manufacturer),
      ])
    ).map((val) => ({ label: val, value: val }));
    res.json(suggestions);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Low stock medicines
// ==========================
export const getLowStockMeds = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 5;
    const meds = await Medicine.find({
      monthlyStockQuantity: { $lte: threshold },
    }).select(
      "_id name genericName manufacturer type batchNumber expiryDate monthlyStockQuantity"
    );
    res.json(meds);
  } catch (err) {
    console.error("Error fetching low-stock medicines:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ==========================
// Add stock & update expiry
// ==========================
export const addStockAndExpiry = async (req, res) => {
  try {
    const { addedQuantity, expiryDate } = req.body;
    const increment = parseInt(addedQuantity, 10) || 0;

    const med = await Medicine.findById(req.params.id);
    if (!med) return res.status(404).json({ error: "Medicine not found" });

    med.monthlyStockQuantity = (med.monthlyStockQuantity || 0) + increment;
    if (expiryDate) med.expiryDate = new Date(expiryDate);

    await med.save();
    res.json(med);
  } catch (err) {
    console.error("Error adding stock to medicine:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================
// Add medicine by medical staff
// ==========================
export const createMedicine = async (req, res) => {
  try {
    const med = new Medicine(req.body);
    await med.save();
    res.status(201).json({ message: "Medicine added", medicine: med });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Medicine already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
};