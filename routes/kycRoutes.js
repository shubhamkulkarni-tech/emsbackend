import express from "express";
import protect, { authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadKycDocs } from "../middleware/kycUpload.js";

import {
  upsertEmployeeKyc,
  getEmployeeKyc,
  verifyKyc,
  listKyc,
  getEmployeesMissingKyc,
} from "../controllers/kycController.js";

const router = express.Router();

/* ✅ IMPORTANT: Static routes FIRST */

// ✅ Missing/Empty KYC Employees (Admin/HR)
router.get("/missing", protect, authorizeRoles("admin", "hr"), getEmployeesMissingKyc);

// ✅ Admin/HR list (pending/verified/rejected)
router.get("/", protect, authorizeRoles("admin", "hr"), listKyc);

// ✅ Verify / Reject (Admin/HR)
router.patch("/:employeeId/verify", protect, authorizeRoles("admin", "hr"), verifyKyc);

// ✅ Employee/Admin Save KYC
router.post("/:employeeId", protect, uploadKycDocs, upsertEmployeeKyc);

// ✅ Get single employee KYC (KEEP LAST)
router.get("/:employeeId", protect, getEmployeeKyc);

export default router;
