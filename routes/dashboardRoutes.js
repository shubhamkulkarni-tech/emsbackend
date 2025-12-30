import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = express.Router();

// GET /api/dashboard/:employeeId
router.get("/:employeeId", getDashboardStats);

export default router;
