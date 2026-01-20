import EmployeeKYC from "../models/EmployeeKYC.js";
import User from "../models/User.js";

export const upsertEmployeeKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const data = req.body;

    // documents links
    const docs = {};
    if (req.files?.aadhaarFront) docs.aadhaarFront = `/uploads/kyc/${req.files.aadhaarFront[0].filename}`;
    if (req.files?.aadhaarBack) docs.aadhaarBack = `/uploads/kyc/${req.files.aadhaarBack[0].filename}`;
    if (req.files?.panCard) docs.panCard = `/uploads/kyc/${req.files.panCard[0].filename}`;
    if (req.files?.passbook) docs.passbook = `/uploads/kyc/${req.files.passbook[0].filename}`;
    if (req.files?.photo) docs.photo = `/uploads/kyc/${req.files.photo[0].filename}`;

    // ✅ Always keep old docs + update only new ones
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
        // ✅ Whenever employee updates docs again => pending
        status: existing?.status === "verified" ? "pending" : (existing?.status || "pending"),
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: "KYC saved successfully", kyc });
  } catch (err) {
    console.error("upsertEmployeeKyc error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getEmployeeKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const kyc = await EmployeeKYC.findOne({ employeeId });
    res.json({ success: true, kyc });
  } catch (err) {
    console.error("getEmployeeKyc error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ for Admin panel list (pending/verified/rejected)
export const listKyc = async (req, res) => {
  try {
    const status = req.query.status; // optional

    const filter = {};
    if (status) filter.status = status;

    const list = await EmployeeKYC.find(filter)
      .populate("employeeId", "name email phone role employeeId profileImage") // ✅ if employeeId is ObjectId ref
      .sort({ updatedAt: -1 });

    res.json({ success: true, kycList: list });
  } catch (err) {
    console.error("listKyc error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status, remarks } = req.body;

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

    res.json({ success: true, message: "KYC status updated", kyc });
  } catch (err) {
    console.error("verifyKyc error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
export const getEmployeesMissingKyc = async (req, res) => {
  try {
    // ✅ Get all employees (exclude admins if you want)
    const employees = await User.find({
      role: { $in: ["employee", "manager", "hr"] }, // admin remove
    }).select("name email phone role employeeId department designation profileImage createdAt");

    // ✅ Get all KYC records
    const kycList = await EmployeeKYC.find().select("employeeId status panNumber aadhaarNumber documents updatedAt");

    // ✅ Map employeeId => kyc
    const kycMap = new Map();
    for (const kyc of kycList) {
      kycMap.set(String(kyc.employeeId), kyc);
    }

    // ✅ Helper: check if KYC incomplete
    const isIncompleteKyc = (kyc) => {
      if (!kyc) return true;

      const hasPan = kyc.panNumber && kyc.panNumber.trim().length > 0;
      const hasAadhaar = kyc.aadhaarNumber && String(kyc.aadhaarNumber).trim().length > 0;

      const docs = kyc.documents || {};
      const hasAnyDoc =
        !!docs.aadhaarFront || !!docs.aadhaarBack || !!docs.panCard || !!docs.passbook || !!docs.photo;

      // Incomplete if no PAN + no Aadhaar + no docs
      return !(hasPan || hasAadhaar || hasAnyDoc);
    };

    const result = employees.map((emp) => {
      const kyc = kycMap.get(String(emp._id));

      if (!kyc) {
        return {
          employee: emp,
          kycStatus: "not_submitted",
          kycUpdatedAt: null,
        };
      }

      // ✅ if record exists but empty data
      if (isIncompleteKyc(kyc)) {
        return {
          employee: emp,
          kycStatus: "incomplete",
          kycUpdatedAt: kyc.updatedAt,
        };
      }

      // ✅ else normal status
      return {
        employee: emp,
        kycStatus: kyc.status || "pending",
        kycUpdatedAt: kyc.updatedAt,
      };
    });

    // ✅ Only return those not submitted OR incomplete
    const missing = result.filter((x) => ["not_submitted", "incomplete"].includes(x.kycStatus));

    res.json({
      success: true,
      total: missing.length,
      data: missing,
    });
  } catch (err) {
    console.error("getEmployeesMissingKyc error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};