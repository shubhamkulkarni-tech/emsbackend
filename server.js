import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import http from "http";

// ROUTES
import userRoutes from "./routes/userRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import dashboardRoute from "./routes/dashboardRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import taskRoutes from "./routes/tasks.Routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import employeeDocumentRoutes from "./routes/documentRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";

// CONTROLLER
import { autoPunchOutCron } from "./controllers/attendanceController.js";

dotenv.config();

// Fix __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ✅ REQUIRED FOR RENDER COOKIES
app.set("trust proxy", 1);

// ================= CORS =================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "https://ems.wordlanetech.com"
];

const corsOptions = {
  origin: function (origin, callback) {
    // For credentials: true, the origin MUST be exact.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight for all routes (Express 5 syntax)
app.options("*", cors(corsOptions)); 

// ================= DEBUG LOGGING =================
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url} - Origin: ${req.headers.origin || "No Origin"}`);
  next();
});

// ================= MIDDLEWARE =================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= ROUTES =================

app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/projects", projectRoutes);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leaves", leaveRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/documents", employeeDocumentRoutes);
app.use("/api/payroll", payrollRoutes);

// ================= CRON =================

cron.schedule(
  "1 18 * * *",
  () => {
    console.log("⏰ Auto Punch Out Running...");
    autoPunchOutCron();
  },
  { timezone: "Asia/Kolkata" }
);

// ================= HEALTH =================

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK",
    version: "CORS_FIX_V3_REFLECTIVE" // DIAGNOSTIC TAG
  });
});

// ================= ERROR =================

app.use((err, req, res, next) => {
  console.error(err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      message: "CORS blocked",
      origin: req.headers.origin,
    });
  }

  res.status(500).json({ message: "Server error" });
});

// ================= 404 =================

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ================= DB =================

if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI missing");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch((err) => console.log(err));

// ================= START =================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});