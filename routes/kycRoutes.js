import express from "express";
import protect, { authorizeRoles } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { uploadKycDocs } from "../middleware/kycUpload.js";

import {
  upsertEmployeeKyc,
  getEmployeeKyc,
  verifyKyc,
  listKyc,
} from "../controllers/kycController.js";

const router = express.Router();

// ✅ Admin/HR list
router.get("/", protect, allowRoles("admin", "hr"), listKyc);

// ✅ Save / Update KYC (employee/admin)
router.post(
  "/:employeeId",
  protect,
  uploadKycDocs,
  upsertEmployeeKyc
);

// ✅ Get single employee kyc
router.get("/:employeeId", protect, getEmployeeKyc);

// ✅ Verify / Reject (admin/hr only)
router.patch(
  "/:employeeId/verify",
  protect,
  allowRoles("admin", "hr"),
  verifyKyc
);

export default router;
