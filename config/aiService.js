import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";
import Symptom from "../models/symptom.js";

/* ---------------- GROQ CLIENT ---------------- */
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/* ---------------- MAIN FUNCTION ---------------- */
export const analyzeSymptoms = async (symptoms) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      {
        role: "system",
        content: `
You are MBSTU AI medical assistant.

Rules:
- Do NOT give final diagnosis
- Suggest possible diseases only
- Always recommend doctor visit
- Detect severity: low, medium, high

Return STRICT JSON format:

{
  "possibleDiseases": ["disease1", "disease2"],
  "explanation": "...",
  "advice": "...",
  "warning": "...",
  "severity": "low | medium | high"
}
        `,
      },
      {
        role: "user",
        content: symptoms,
      },
    ],
  });

  let aiData;

  try {
    aiData = JSON.parse(response.choices[0].message.content);
  } catch (err) {
    // fallback (safe mode)
    aiData = {
      possibleDiseases: [],
      explanation: response.choices[0].message.content,
      advice: "Please consult a doctor",
      warning: "If symptoms worsen, seek medical help immediately",
      severity: "medium",
    };
  }

  /* ---------------- SAVE TO DB ---------------- */
  await Symptom.create({
    userMessage: symptoms,
    aiResponse: aiData.explanation,
    possibleDiseases: aiData.possibleDiseases,
    severity: aiData.severity,
  });

  return aiData;
};