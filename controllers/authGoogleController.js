import dotenv from "dotenv";
dotenv.config();

import express from "express";
import passport from "passport";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import UniversityMember from "../models/universityMember.js";
import MedicalUser from "../models/medicalUser.js";

const router = express.Router();
const app = express();
app.use(cookieParser());

// ===== Passport Google Strategy =====
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value.toLowerCase();

        // Check in MedicalUser
        let user = await MedicalUser.findOne({
          emails: { $elemMatch: { $regex: new RegExp(`^${email}$`, "i") } },
        });

        if (!user) {
          // Check in UniversityMember
          const universityUser = await UniversityMember.findOne({
            emails: { $elemMatch: { $regex: new RegExp(`^${email}$`, "i") } },
          });

          if (universityUser) {
            const role = MedicalUser.determineRole(
              universityUser.userType,
              universityUser.designation,
              universityUser.office
            );

            user = new MedicalUser({
              uniqueId: universityUser.uniqueId,
              name: universityUser.name,
              userType: universityUser.userType,
              sex: universityUser.sex,
              department: universityUser.department,
              office: universityUser.office,
              designation: universityUser.designation,
              designation_2: universityUser.designation_2,
              program: universityUser.program,
              hall: universityUser.hall,
              session: universityUser.session,
              bloodGroup: universityUser.bloodGroup,
              dob: universityUser.dob,
              emails: universityUser.emails,
              phone: universityUser.phone,
              photo: universityUser.photo,
              googleId: profile.id,
              role: role,
            });

            await user.save();
          } else {
            return done(null, false, {
              message: "User not found in university records",
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ===== Serialize & Deserialize =====
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ===== Google Auth Route =====
export const auth_google = [
  (req, res, next) => {
    if (req.cookies.role) {
      req.session.role = req.cookies.role;
    }
    next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
];

// ===== Google Callback =====
export const auth_google_callback = (req, res, next) => {
  passport.authenticate("google", (err, user) => {
    
    if (err) return next(err);
    if (!user) return res.redirect("https://mbstu-medical-service.netlify.app");

    req.session.regenerate((err) => {
      if (err) return next(err);

      req.logIn(user, (err) => {
        if (err) return next(err);

        req.session.user = {
          id: user._id,
          uniqueId: user.uniqueId,
          name: user.name,
          role: user.role,
        };

        req.session.save((err) => {
          if (err) {
            // console.error("❌ Session save failed:", err);
            return next(err);
          }

          // console.log("✅ Session saved with user:", req.session.user);

          const redirectUrl = user.password
            ? process.env.REDIRECT_URL_GOOGLE_REDIRECT
            : process.env.REDIRECT_URL_SET_PASSWORD;

            // console.log("Redirecting to:", redirectUrl);

          return res.redirect(redirectUrl);
        });
      });
    });
  })(req, res, next);
};

// ===== Logout =====
export const logout_get = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send("Logout failed");

    res.clearCookie("connect.sid");
    res.status(200).send("Logged out successfully");
    res.redirect("https://mbstu-medical-service.netlify.app");
  });
};

// ===== Set Password for Google User =====
export const setPasswordGoogle = async (req, res) => {
  const { uniqueId, password } = req.body;
  try {
    const user = await MedicalUser.findOne({ uniqueId });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    // console.log("✅ Password saved");

    return res.status(200).json({ success: true });
  } catch (e) {
    // console.log("Set password error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};