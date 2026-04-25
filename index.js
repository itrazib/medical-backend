import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import http from "http";
import helmet from "helmet";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import mainRoutes from "./routes/main.js";

import MongoStore from "connect-mongo";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 2000;

/* ---------------- TRUST PROXY ---------------- */
app.set("trust proxy", 1);

/* ---------------- CORS ---------------- */
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "https://mbstu-medical-service.netlify.app",
    ],
    credentials: true,
  })
);

/* ---------------- BODY ---------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------------- SESSION (FIXED) ---------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),

    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    },
  })
);

/* ---------------- SECURITY ---------------- */
app.use(helmet());

/* ---------------- DB ---------------- */
await connectDB();

/* ---------------- ROUTES ---------------- */
app.use("/", mainRoutes);

/* ---------------- SOCKET ---------------- */
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "https://mbstu-medical-service.netlify.app",
    ],
    credentials: true,
  },
});

/* ---------------- START ---------------- */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});