import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import http from "http";


// --- ROUTES IMPORTS ---
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

// --- CONTROLLER IMPORTS ---
import { autoPunchOutCron } from "./controllers/attendanceController.js";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ TRUST PROXY (Required for Render)
app.set("trust proxy", 1);

// ✅ CORS CONFIG (Hostinger Frontend + Localhost)
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:5000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5000",
      "https://ems.wordlanetech.com",
      "https://backend-node-5ylk.onrender.com"
    ];

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`❌ CORS Error: Origin ${origin} not allowed`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ API ROUTES
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/projects", projectRoutes);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leaves", leaveRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/uploads", express.static("uploads"));
app.use("/api/documents", employeeDocumentRoutes);

app.use("/api/payroll", payrollRoutes);


// ✅ AUTO PUNCH OUT CRON JOB
cron.schedule(
  "1 18 * * *",
  () => {
    console.log("⏰ [CRON] Running Auto Punch Out Job at 18:01...");
    autoPunchOutCron();
  },
  { timezone: "Asia/Kolkata" }
);

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      message: "CORS error: Origin not allowed",
      origin: req.headers.origin,
    });
  }

  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

// ✅ 404 handler (API only)
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ✅ MongoDB connection
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port: ${PORT}`);
});
