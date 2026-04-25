// === routes/authRoutes.js ===
import express from "express";
// import  authIdController from "../controllers/authIdController.js";
// import  authGoogleController from "../controllers/authGoogleController.js";
// import  authPasswordController from "../controllers/authPasswordController.js";
import {
    fetchMember,
    sendOtp,
    verifyOtp,
    saveUserPassword,
    login,
} from "../controllers/authIdController.js";
import {
    auth_google,
    auth_google_callback,
    logout,
    setPasswordGoogle,
    
} from "../controllers/authGoogleController.js";
import {
    fetchUserForReset,
    sendResetOtp,
    verifyResetOtp,
    resetPassword,
} from "../controllers/authPasswordController.js";


const router = express.Router();

// Regular auth
router.get("/fetch-member/:uniqueId", fetchMember);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/save-user-password", saveUserPassword);
router.post("/login", login);

// Google auth
router.post("/set-password-google", setPasswordGoogle);
router.get("/google", auth_google);
router.get("/google/callback", auth_google_callback);
router.get("/logout", logout);

// Forgot password flow
router.post("/forgot-password/send-otp", sendResetOtp);
router.post("/forgot-password/verify-otp", verifyResetOtp);
router.post(
  "/forgot-password/reset-password",
  resetPassword
);
router.get(
  "/forgot-password/fetch-member/:uniqueId",
  fetchUserForReset
);

export default router;