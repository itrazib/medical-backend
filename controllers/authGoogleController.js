import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import UniversityMember from "../models/universityMember.js";
import MedicalUser from "../models/medicalUser.js";

const router = express.Router();

// ======================
// GOOGLE STRATEGY
// ======================
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

        let user = await MedicalUser.findOne({
          emails: { $elemMatch: { $regex: new RegExp(`^${email}$`, "i") } },
        });

        if (!user) {
          const universityUser = await UniversityMember.findOne({
            emails: { $elemMatch: { $regex: new RegExp(`^${email}$`, "i") } },
          });

          if (!universityUser) return done(null, false);

          const role = MedicalUser.determineRole(
            universityUser.userType,
            universityUser.designation,
            universityUser.office
          );

          user = await MedicalUser.create({
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
            role,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ======================
// SERIALIZE FIXED
// ======================
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await MedicalUser.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ======================
// GOOGLE LOGIN
// ======================
export const auth_google = passport.authenticate("google", {
  scope: ["profile", "email"],
});

// ======================
// GOOGLE CALLBACK
// ======================
export const auth_google_callback = (req, res, next) => {
  passport.authenticate("google", (err, user) => {
    if (err) return next(err);

    if (!user) {
      return res.redirect(process.env.FRONTEND_URL);
    }

    req.logIn(user, (err) => {
      if (err) return next(err);

      req.session.user = {
        id: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        role: user.role,
      };

      req.session.save(() => {
        const redirectUrl = user.password
          ? process.env.REDIRECT_URL_GOOGLE_REDIRECT
          : process.env.REDIRECT_URL_SET_PASSWORD;

        return res.redirect(redirectUrl);
      });
    });
  })(req, res, next);
};

// ======================
// LOGOUT (SAFE)
// ======================
export const logout = (req, res) => {
  req.logout?.(() => {});

  req.session?.destroy(() => {
    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.status(200).json({
      message: "Logged out successfully",
    });
  });
};

// ======================
// SET PASSWORD
// ======================
export const setPasswordGoogle = async (req, res) => {
  try {
    const { uniqueId, password } = req.body;

    const user = await MedicalUser.findOne({ uniqueId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    return res.json({
      success: true,
      message: "Password set successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export default router;