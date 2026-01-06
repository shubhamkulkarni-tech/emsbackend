import express from "express";
import {
  createAttendance,
  logoutAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  markAttendance,
  updateAttendance, // Added
  deleteAttendance, // Added
} from "../controllers/attendanceController.js";

const router = express.Router();

// GET All
router.get("/", getAllAttendance);

// GET by Employee
router.get("/employee/:employeeId", getAttendanceByEmployee);

// POST Create (Punch In)
router.post("/", createAttendance);

// PUT Mark (Absent/Leave)
router.put("/mark", markAttendance);

// PUT Logout (Punch Out)
router.put("/logout", logoutAttendance);

// UPDATE Generic Edit (by ID) - Example: /api/attendance/65a1b2c3...
router.put("/:id", updateAttendance);

// DELETE Record (by ID) - Example: /api/attendance/65a1b2c3...
router.delete("/:id", deleteAttendance);

export default router;