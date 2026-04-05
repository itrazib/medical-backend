// routes/medicines.js
import express from "express";
import { body, validationResult } from "express-validator";

import { getDispenseReq, addStockAndExpiry, changeMonthlyStock, changeStatus, createMedicine, deleteMedicine, getAllMedicine, getLowStockMeds, getSingleMedicine, postSingleMedicine, searchMedicine, updateMedicine } from "../controllers/medicineController.js";


const router = express.Router();

// Middleware: check if user is medical-staff
const isMedicalStaff = (req, res, next) => {
  console.log(req.session.user);
  if (req.session.user && req.session.user.role === "medical-staff") return next();
  return res.status(403).send("Access denied");
};

router.use(isMedicalStaff);

// ------------------------ Pending medicine requests ------------------------
router.get("/dispense-records", getDispenseReq);
router.patch("/dispense-records/:id", changeStatus);
router.post("/dispenses-records/:id/finalize", changeMonthlyStock);

// ------------------------ Manage medicine ------------------------
router.get("/medicines", getAllMedicine);
router.get("/medicines/:id", getSingleMedicine);
router.post("/medicines",postSingleMedicine);
router.delete("/medicines/:id", deleteMedicine);
router.get("/search-medicine", searchMedicine);

router.put(
  "/medicines/:id",
  [
    body("name").optional().isString().trim().notEmpty(),
    body("genericName").optional().isString().trim().notEmpty(),
    body("type").optional().isString().trim().notEmpty(),
    body("mainStockQuantity").optional().isInt({ min: 0 }),
    body("monthlyStockQuantity").optional().isInt({ min: 0 }),
    body("dosage").optional().isString().trim(),
    body("manufacturer").optional().isString().trim(),
    body("price").optional().isFloat({ min: 0 }),
    body("expiryDate").optional().isISO8601(),
    body("batchNumber").optional().isString().trim(),
    body("storageCondition").optional().isString().trim(),
    body("sideEffects").optional().isArray(),
    body("usageInstructions").optional().isString().trim(),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  updateMedicine
);

// Incremental stock + expiry update
router.patch(
  "/medicines/:id/add-stock",
  [
    body("addedQuantity").isInt({ min: 0 }).withMessage("Quantity must be non-negative integer"),
    body("expiryDate").optional().isISO8601().withMessage("Invalid date format"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  addStockAndExpiry
);

router.get("/low-stock", getLowStockMeds);
router.post("/add-medicine", createMedicine);

// ------------------------ Dispensed report ------------------------
router.get("/dispensed-report", async (req, res) => {
  const now = new Date();
  const startDate = req.query.start ? new Date(req.query.start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = req.query.end
    ? (() => {
        const d = new Date(req.query.end);
        d.setDate(d.getDate() + 1);
        return d;
      })()
    : now;

  try {
    const report = await DispenseRecord.aggregate([
      {
        $match: {
          overallStatus: "completed",
          dispensedAt: { $gte: startDate, $lt: endDate },
        },
      },
      { $unwind: "$medicines" },
      {
        $group: {
          _id: "$medicines.medicine",
          dispensedQuantity: { $sum: "$medicines.quantity" },
        },
      },
      {
        $lookup: {
          from: "medicines",
          localField: "_id",
          foreignField: "_id",
          as: "medicineDoc",
        },
      },
      { $unwind: "$medicineDoc" },
      {
        $project: {
          _id: 0,
          medicineId: "$_id",
          name: "$medicineDoc.name",
          dispensedQuantity: 1,
          remainingMonthlyStock: "$medicineDoc.monthlyStockQuantity",
        },
      },
      { $sort: { dispensedQuantity: -1 } },
    ]);
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;