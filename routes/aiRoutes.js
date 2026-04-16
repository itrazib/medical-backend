import express from "express";
import OpenAI from "openai";
import Symptom from "../models/symptom.js";

const router = express.Router();

/* ---------------- GROQ CLIENT ---------------- */
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/* ---------------- AI FUNCTION ---------------- */
const analyzeSymptoms = async (message) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `
You are MBSTU AI medical assistant.

Rules:
- Do NOT give final diagnosis
- Only suggest possible conditions
- Always recommend doctor visit
- Structured format:
1. Possible causes
2. Advice
3. When to see doctor
4. Warning (if needed)
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  const reply = response.choices[0].message.content;

  await Symptom.create({
    userMessage: message,
    aiResponse: reply,
  });

  return reply;
};

/* ---------------- CHAT ROUTE ---------------- */
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const reply = await analyzeSymptoms(message);

    res.json({
      success: true,
      reply,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      error: "AI error",
    });
  }
});

/* ---------------- HISTORY ROUTE ---------------- */
router.get("/history", async (req, res) => {
  try {
    const history = await Symptom.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch history",
    });
  }
});

export default router;