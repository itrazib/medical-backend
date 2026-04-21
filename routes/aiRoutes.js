// import express from "express";
// import { analyzeSymptoms } from "../config/aiService.js";
// // import { analyzeSymptoms } from "../utils/ai.js";

// const router = express.Router();

// router.post("/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     const aiData = await analyzeSymptoms(message);

//     res.json(aiData);
//   } catch (err) {
//     res.status(500).json({ error: "AI error" });
//   }
// });

// export default router;
import express from "express";
import { chat } from "../controllers/aiController.js";


const router = express.Router();
router.post("/chat", chat);

export default router;
