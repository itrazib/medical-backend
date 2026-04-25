// === controllers/authPasswordController.js ===
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { check, validationResult } from "express-validator";

import MedicalUser from "../models/medicalUser.js";
import OtpModel from "../models/otp.js";

// Utility: wrap async routes
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ==========================
// Fetch user for password reset
// ==========================
export const fetchUserForReset = asyncHandler(async (req, res) => {
  try {
    const uniqueId = req.params.uniqueId;

    const member = await MedicalUser.findOne({
      uniqueId: new RegExp(`^${uniqueId}$`, "i"),
    });

    if (!member) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, member });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==========================
// Send OTP for password reset
// ==========================
export const sendResetOtp = asyncHandler(async (req, res) => {
  await check("uniqueId", "Unique ID is required").notEmpty().run(req);
  await check("email", "Valid email is required").isEmail().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  const { uniqueId, email } = req.body;

  // 🔥 case-insensitive search
  const user = await MedicalUser.findOne({
    uniqueId: new RegExp(`^${uniqueId}$`, "i"),
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (!user.emails.includes(email)) {
    return res.status(400).json({
      success: false,
      message: "Email not associated with user",
    });
  }

  // 🔥 OTP generate
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 🔥 store normalized ID
  const normalizedId = user.uniqueId;

  await OtpModel.findOneAndUpdate(
    { uniqueId: normalizedId },
    {
      uniqueId: normalizedId,
      otp,
      createdAt: Date.now(),
      retryCount: 0,
    },
    { upsert: true, new: true }
  );

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your password reset code is ${otp}`,
    });

    return res.json({
      success: true,
      message: `OTP sent to ${email}`,
    });
  } catch (err) {
    console.log("Email error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

// ==========================
// Verify OTP
// ==========================
export const verifyResetOtp = asyncHandler(async (req, res) => {
  await check("uniqueId", "Unique ID is required").notEmpty().run(req);
  await check("otp", "OTP is required").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  const { uniqueId, otp } = req.body;

  // 🔥 case-insensitive search
  const record = await OtpModel.findOne({
    uniqueId: new RegExp(`^${uniqueId}$`, "i"),
  });

  if (!record) {
    return res.status(410).json({
      success: false,
      message: "OTP expired or not found",
    });
  }

  // 🔥 expiry check (5 min)
  const isExpired = Date.now() - record.createdAt > 5 * 60 * 1000;
  if (isExpired) {
    await OtpModel.deleteOne({ uniqueId: record.uniqueId });

    return res.status(410).json({
      success: false,
      message: "OTP expired",
    });
  }

  // 🔥 retry limit
  if (record.retryCount >= 3) {
    return res.status(429).json({
      success: false,
      message: "Too many attempts. Try again later.",
    });
  }

  // 🔥 OTP check
  if (record.otp !== otp) {
    await OtpModel.updateOne(
      { uniqueId: record.uniqueId },
      { $inc: { retryCount: 1 } }
    );

    return res.status(401).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  // ✅ success → delete OTP
  await OtpModel.deleteOne({ uniqueId: record.uniqueId });

  return res.json({
    success: true,
    message: "OTP verified successfully",
  });
});

// ==========================
// Reset password
// ==========================
export const resetPassword = asyncHandler(async (req, res) => {
  await check("uniqueId").notEmpty().run(req);
  await check("password").isLength({ min: 6 }).run(req);
  await check("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  const { uniqueId, password } = req.body;

  const user = await MedicalUser.findOne({
    uniqueId: new RegExp(`^${uniqueId}$`, "i"),
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // 🔥 password update
  user.password = await bcrypt.hash(password, 10);
  await user.save();

  return res.json({
    success: true,
    message: "Password reset successful",
  });
});