// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import session from "express-session";
import connectMongoDBSession from "connect-mongodb-session";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";

import connectDB from "./config/db.js";
import mainRoutes from "./routes/main.js";

const MongoDBStore = connectMongoDBSession(session);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // socket.io cors
  },
});

const PORT = process.env.PORT || 2000;

// --- MongoDB session store ---
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions",
});

store.on("error", function (error) {
  console.error("SESSION STORE ERROR:", error);
});

// --- Trust proxy if behind reverse proxy ---
app.set("trust proxy", 1);

// --- CORS with credentials ---
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  process.env.BACKEND_URL || `http://localhost:${PORT}`,
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
    credentials: true, // important for cookies
  })
);

// --- Middleware ---
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false, // only save when session is modified
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    },
  })
);

app.use(helmet());

// --- Optional Mongo sanitize ---
// import mongoSanitize from "express-mongo-sanitize";
// app.use(mongoSanitize());

// --- Routes ---
app.use("/", mainRoutes);

// --- Socket.io attach ---
app.set("io", io);

// --- Connect Database ---
connectDB();

// --- Start server ---
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});