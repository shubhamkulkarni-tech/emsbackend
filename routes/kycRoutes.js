import express from "express";
import { getEmployeeKyc, upsertEmployeeKyc, verifyKyc } from "../controllers/kycController.js";
import { uploadKycDocs } from "../middleware/uploadKyc.js";

const router = express.Router();

router.get("/:employeeId", getEmployeeKyc);
router.post("/:employeeId", uploadKycDocs, upsertEmployeeKyc);
router.patch("/:employeeId/verify", verifyKyc);

export default router;
