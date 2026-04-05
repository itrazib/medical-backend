// routes/universityMember.js
import express from "express";
import { UniversityDBAdmin } from "../models/admin.js";
import UniversityMember from "../models/universityMember.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, GetObjectAclCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../config/awsConfig.js";
import { generateFileName } from "../helper/utils.js";
import multer from "multer";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
      data.emails = data.emails.split(",").map((email) => email.trim());
      data.uniqueId = data.uniqueId.toLowerCase();

      const photoFile = req.file;
      data.photo = generateFileName();

      const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: data.photo,
        Body: photoFile.buffer,
        ContentType: photoFile.mimetype,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const newMember = new UniversityMember(data);
      await newMember.save();

      console.log(newMember);
      res.status(200).send({ message: "Member added successfully!" });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "An error occurred while adding the member." });
    }
  }
);

export default router;