import express from "express";
import UniversityMember from "../models/universityMember.js";
import { upload } from "../helper/multer.js";
// import { upload } from "../middleware/upload.js";

const router = express.Router();

const isUniversityAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === "university-admin") {
    return next();
  }
  return res.status(403).send("Access denied");
};

router.post(
  "/add-member",
  isUniversityAdmin,
  upload.single("photo"),
  async (req, res) => {
    try {
      const data = req.body;

      data.emails = data.emails.split(",").map((e) => e.trim());
      data.uniqueId = data.uniqueId.toLowerCase();

      // 🔥 Cloudinary auto gives file URL
      data.photo = req.file.path;

      const newMember = new UniversityMember(data);
      await newMember.save();

      res.status(200).send({
        message: "Member added successfully!",
        member: newMember,
      });
    } catch (err) {
      console.log(err);
      res.status(500).send({
        message: "Error adding member",
      });
    }
  }
);

export default router;