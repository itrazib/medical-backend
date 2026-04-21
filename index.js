import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import session from "express-session";
import connectMongoDBSession from "connect-mongodb-session";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";

import connectDB from "./config/db.js";
import mainRoutes from "./routes/main.js";
import Symptom from "./models/symptom.js";
import OpenAI from "openai";

const MongoDBStore = connectMongoDBSession(session);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 2000;

/* ---------------- SOCKET ---------------- */
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

/* ---------------- SESSION STORE ---------------- */
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions",
});

store.on("error", (error) => {
  console.error("SESSION STORE ERROR:", error);
});

/* ---------------- TRUST PROXY ---------------- */
app.set("trust proxy", 1);

/* ---------------- CORS ---------------- */
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

/* ---------------- MIDDLEWARE ---------------- */
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    },
  })
);

app.use(helmet());

/* ---------------- DB ---------------- */
connectDB();

/* ---------------- ROUTES ---------------- */
app.use("/", mainRoutes);

/* ---------------- GROQ AI (FIXED) ---------------- */
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/* ---------------- AI FUNCTION ---------------- */
// const analyzeSymptoms = async (message) => {
//   const response = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       {
//         role: "system",
//         content: `
// You are MBSTU AI Medical Doctor.

// Return STRICT JSON ONLY:

// {
//   "possibleCauses": [],
//   "explanation": "",
//   "advice": "",
//   "warning": "",
//   "severity": "low | medium | high"
// }

// Rules:
// - No final diagnosis
// - Always suggest doctor visit
// - Simple Bangla + English mix
//         `,
//       },
//       {
//         role: "user",
//         content: message,
//       },
//     ],
//   });

//   let aiData;

//   try {
//     aiData = JSON.parse(response.choices[0].message.content);
//   } catch (e) {
//     aiData = {
//       possibleCauses: [],
//       explanation: response.choices[0].message.content,
//       advice: "Consult doctor",
//       warning: "If severe, go hospital",
//       severity: "medium",
//     };
//   }

//   return aiData;
// };

/* ---------------- SOCKET LOGIC ---------------- */
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("send_message", async (data) => {
    try {
      // 1️⃣ user message
      io.to(data.room).emit("receive_message", {
        sender: "USER",
        message: data.message,
      });

      // 2️⃣ AI response (GROQ)
      const aiData = await analyzeSymptoms(data.message);

      // 3️⃣ save DB
      await Symptom.create({
        userMessage: data.message,
        aiResponse: aiData.explanation,
        possibleDiseases: aiData.possibleCauses,
        severity: aiData.severity,
      });

      // 4️⃣ send AI reply
      io.to(data.room).emit("receive_message", {
        sender: "AI_DOCTOR",
        message: aiData.explanation,
        severity: aiData.severity,
      });

    } catch (err) {
      console.log(err);

      io.to(data.room).emit("receive_message", {
        sender: "AI_DOCTOR",
        message: "AI temporarily unavailable. Try again.",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

/* ---------------- START ---------------- */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});