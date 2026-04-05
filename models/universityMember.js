import mongoose from "mongoose";

const universityMemberSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  userType: {
    type: String,
    enum: ["student", "teacher", "staff"],
    required: true,
  },
  sex: {
    type: String,
    enum: ["male", "female"],
    required: true,
  },
  department: {
    type: String,
  },
  program: {
    type: String,
    enum: ["graduate", "undergraduate", ""],
  },
  office: {
    type: String,
  },
  designation: {
    type: String,
  },
  designation_2: {
    type: String,
  },
  hall: {
    type: String,
  },
  session: { type: String },
  bloodGroup: {
    type: String,
  },
  dob: { type: Date, required: true },
  emails: {
    type: [String],
  },
  phone: {
    type: String,
    required: true,
  },
  photo: {
    type: String,
  },
});
 const UniversityMember = mongoose.model(
  "UniversityMember",
  universityMemberSchema
);
export default UniversityMember;

