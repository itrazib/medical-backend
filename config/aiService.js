import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// emergency keywords (fast safety check)
const emergencyKeywords = [
  "chest pain",
  "breathing problem",
  "unconscious",
  "bleeding",
  "stroke",
  "heart attack",
  "severe pain",
];

export const askGroq = async (message) => {
  const lowerMsg = message.toLowerCase();

  const keywordEmergency = emergencyKeywords.some((k) =>
    lowerMsg.includes(k)
  );

  // 🔥 smart intent detection
  const smallTalkKeywords = [
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "ok",
    "okay",
    "bye",
  ];

  const isSmallTalk = smallTalkKeywords.some((w) =>
    lowerMsg.includes(w)
  );

  const SYSTEM_PROMPT = `
You are MBSTU AI Medical Assistant.

You behave like ChatGPT but focused on medical help.

━━━━━━━━━━━━━━━━━━
RULES:
━━━━━━━━━━━━━━━━━━
1. First understand user intent
2. If greeting/thanks → reply ONLY 1 line
3. If casual chat → 1 sentence max
4. If medical problem → max 4–6 lines
5. Never write long essay
6. Be natural Bangla (friendly tone)
7. Do NOT over-explain

━━━━━━━━━━━━━━━━━━
MEDICAL RULES:
━━━━━━━━━━━━━━━━━━
- Give 2–3 possible causes
- Give simple advice
- Do NOT give final diagnosis
- Suggest doctor only if needed
- Be safe, not overconfident

━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━
User: hi → হাই 😊 কিভাবে সাহায্য করতে পারি?
User: thank you → আপনাকে স্বাগতম 😊

User: মাথা ব্যথা →
সম্ভাব্য কারণ: স্ট্রেস / কম ঘুম / পানিশূন্যতা  
পানি পান করুন ও বিশ্রাম নিন  
প্রয়োজনে Paracetamol নিতে পারেন  
৩ দিন থাকলে ডাক্তার দেখান
`;

  const prompt = isSmallTalk
    ? `User said: ${message}. Reply in ONE short friendly line only.`
    : `Patient symptoms: ${message}`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 300,

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const reply = res.choices[0].message.content;

    return {
      reply,
      emergency: keywordEmergency,
      warning: keywordEmergency
        ? "⚠️ জরুরি লক্ষণ পাওয়া গেছে। দ্রুত ডাক্তার দেখান"
        : "",
    };
  } catch (error) {
    console.log("Groq Error:", error.message);

    return {
      reply: "সার্ভার সমস্যা হচ্ছে। পরে আবার চেষ্টা করুন।",
      emergency: keywordEmergency,
      warning: "Server error",
    };
  }
};