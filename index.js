import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import session from "express-session";
import connectMongoDBSession from "connect-mongodb-session";
import http from "http";
import helmet from "helmet";

import connectDB from "./config/db.js";
import mainRoutes from "./routes/main.js";
import Symptom from "./models/symptom.js";
import OpenAI from "openai";
import { Server } from "socket.io";

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
await connectDB();

/* ---------------- ROUTES ---------------- */
app.use("/", mainRoutes);





// /* ---------------- START ---------------- */
// server.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });