import mongoose from "mongoose";

const employeeKYCSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
    },

    aadhaarNumber: { type: String, required: true },
    panNumber: { type: String, required: true },

    dob: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },

    presentAddress: { type: String },
    permanentAddress: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },

    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String },

    documents: {
      aadhaarFront: { type: String },
      aadhaarBack: { type: String },
      panCard: { type: String },
      passbook: { type: String },
      photo: { type: String },
    },

    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },

    remarks: { type: String }, // rejection reason / notes
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeKYC", employeeKYCSchema);
