import mongoose from "mongoose";
import EmployeeKYC from "../models/EmployeeKYC.js";
import User from "../models/User.js";

/**
 * ✅ Create / Update Employee KYC
 * POST /api/kyc/:employeeId
 */
export const upsertEmployeeKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employeeId" });
    }

    const data = req.body;

    // ✅ Upload docs paths
    const docs = {};
    if (req.files?.aadhaarFront)
      docs.aadhaarFront = `/uploads/kyc/${req.files.aadhaarFront[0].filename}`;
    if (req.files?.aadhaarBack)
      docs.aadhaarBack = `/uploads/kyc/${req.files.aadhaarBack[0].filename}`;
    if (req.files?.panCard)
      docs.panCard = `/uploads/kyc/${req.files.panCard[0].filename}`;
    if (req.files?.passbook)
      docs.passbook = `/uploads/kyc/${req.files.passbook[0].filename}`;
    if (req.files?.photo)
      docs.photo = `/uploads/kyc/${req.files.photo[0].filename}`;

    // ✅ Keep old docs safe
    const existing = await EmployeeKYC.findOne({ employeeId });

    const kyc = await EmployeeKYC.findOneAndUpdate(
      { employeeId },
      {
        ...data,
        employeeId,
        documents: {
          ...(existing?.documents || {}),
          ...docs,
        },
        // ✅ if employee re-uploads after verified -> set pending again
        status: existing?.status === "verified" ? "pending" : existing?.status || "pending",
      },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: "KYC saved successfully",
      kyc,
    });
  } catch (err) {
    console.error("upsertEmployeeKyc error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ✅ Get Single Employee KYC
 * GET /api/kyc/:employeeId
 */
export const getEmployeeKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // ✅ Validate ObjectId (prevents CastError like "missing")
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employeeId" });
    }

    const kyc = await EmployeeKYC.findOne({ employeeId }).populate(
      "employeeId",
      "name email phone role employeeId profileImage department designation"
    );

    return res.json({ success: true, kyc });
  } catch (err) {
    console.error("getEmployeeKyc error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ✅ List KYC (Admin/HR)
 * GET /api/kyc?status=pending
 */
export const listKyc = async (req, res) => {
  try {
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const list = await EmployeeKYC.find(filter)
      .populate("employeeId", "name email phone role employeeId profileImage")
      .sort({ updatedAt: -1 });

    return res.json({ success: true, kycList: list });
  } catch (err) {
    console.error("listKyc error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ✅ Verify / Reject KYC (Admin/HR only)
 * PATCH /api/kyc/:employeeId/verify
 * body: { status: "verified" | "rejected" | "pending", remarks?: "" }
 */
export const verifyKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employeeId" });
    }

    if (!["pending", "verified", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const kyc = await EmployeeKYC.findOneAndUpdate(
      { employeeId },
      {
        status,
        remarks: remarks || "",
        verifiedBy: req.user?._id,
        verifiedAt: new Date(),
      },
      { new: true }
    );

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC record not found" });
    }

    return res.json({ success: true, message: "KYC status updated", kyc });
  } catch (err) {
    console.error("verifyKyc error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ✅ Employees Missing/Empty KYC (Admin/HR)
 * GET /api/kyc/missing
 */
export const getEmployeesMissingKyc = async (req, res) => {
  try {
    // ✅ Get employees (exclude admin)
    const employees = await User.find({
      role: { $in: ["employee", "manager", "hr"] },
    }).select("name email phone role employeeId department designation profileImage createdAt");

    // ✅ Get all KYC
    const kycList = await EmployeeKYC.find().select(
      "employeeId status panNumber aadhaarNumber documents updatedAt"
    );

    // ✅ Map employeeId => KYC
    const kycMap = new Map();
    for (const kyc of kycList) {
      kycMap.set(String(kyc.employeeId), kyc);
    }

    // ✅ Check incomplete kyc (no docs + no pan + no aadhaar)
    const isIncompleteKyc = (kyc) => {
      if (!kyc) return true;

      const hasPan = kyc.panNumber && kyc.panNumber.trim().length > 0;
      const hasAadhaar = kyc.aadhaarNumber && String(kyc.aadhaarNumber).trim().length > 0;

      const docs = kyc.documents || {};
      const hasAnyDoc =
        !!docs.aadhaarFront ||
        !!docs.aadhaarBack ||
        !!docs.panCard ||
        !!docs.passbook ||
        !!docs.photo;

      return !(hasPan || hasAadhaar || hasAnyDoc);
    };

    const result = employees.map((emp) => {
      const kyc = kycMap.get(String(emp._id));

      if (!kyc) {
        return { employee: emp, kycStatus: "not_submitted", kycUpdatedAt: null };
      }

      if (isIncompleteKyc(kyc)) {
        return { employee: emp, kycStatus: "incomplete", kycUpdatedAt: kyc.updatedAt };
      }

      return { employee: emp, kycStatus: kyc.status || "pending", kycUpdatedAt: kyc.updatedAt };
    });

    // ✅ Only show missing/incomplete
    const missing = result.filter((x) =>
      ["not_submitted", "incomplete"].includes(x.kycStatus)
    );

    return res.json({
      success: true,
      total: missing.length,
      data: missing,
    });
  } catch (err) {
    console.error("getEmployeesMissingKyc error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
