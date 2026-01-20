import EmployeeKYC from "../models/EmployeeKYC.js";

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

    const kyc = await EmployeeKYC.findOneAndUpdate(
      { employeeId },
      {
        ...data,
        $set: {
          ...data,
          "documents": { ...docs },
        },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: "KYC saved successfully", kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getEmployeeKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const kyc = await EmployeeKYC.findOne({ employeeId });

    res.json({ success: true, kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyKyc = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { status, remarks } = req.body;

    const kyc = await EmployeeKYC.findOneAndUpdate(
      { employeeId },
      {
        status,
        remarks,
        verifiedBy: req.user?._id,
        verifiedAt: new Date(),
      },
      { new: true }
    );

    res.json({ success: true, message: "KYC status updated", kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
