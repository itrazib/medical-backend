import dotenv from "dotenv";
dotenv.config();

import express from "express";
import passport from "passport";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import session from "express-session";

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import UniversityMember from "../models/universityMember.js";
import MedicalUser from "../models/medicalUser.js";

const router = express.Router();

// =====================================
// MIDDLEWARE (ONLY IF NOT IN SERVER.JS)
// =====================================
router.use(cookieParser());

// =====================================
// SESSION (IMPORTANT: ideally server.js এ থাকবে)
// =====================================
router.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: "none",
    },
  })
);

router.use(passport.initialize());
router.use(passport.session());

// =====================================
// GOOGLE STRATEGY
// =====================================
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
          emails: email,
        });

        if (!user) {
          const universityUser = await UniversityMember.findOne({
            emails: email,
          });

          if (!universityUser) {
            return done(null, false);
          }

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

// =====================================
// SERIALIZE / DESERIALIZE (FIXED)
// =====================================
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await MedicalUser.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// =====================================
// GOOGLE LOGIN
// =====================================
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

// =====================================
// GOOGLE CALLBACK (FIXED)
// =====================================
export const auth_google_callback = (req, res, next) => {
  passport.authenticate("google", (err, user) => {
    if (err) return next(err);

    if (!user)
      return res.redirect(
        "https://mbstu-medical-service.netlify.app"
      );

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
          if (err) return next(err);

          const redirectUrl = user.password
            ? process.env.REDIRECT_URL_GOOGLE_REDIRECT
            : process.env.REDIRECT_URL_SET_PASSWORD;

          return res.redirect(redirectUrl);
        });
      });
    });
  })(req, res, next);
};

// =====================================
// LOGOUT (FIXED SAFE VERSION)
// =====================================
export const logout = (req, res) => {
  try {
    if (req.logout) req.logout(() => {});

    if (req.session) {
      req.session.destroy(() => {
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
    } else {
      res.clearCookie("connect.sid");
      return res.status(200).json({
        message: "Logged out successfully",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =====================================
// SET PASSWORD (GOOGLE USER)
// =====================================
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

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({
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