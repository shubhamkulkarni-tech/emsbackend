import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";

// ---------------- Multer Setup ----------------
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

// ---------------- Login User ----------------
export const loginUser = async (req, res) => {
  try {
    const { employeeId, password, role } = req.body;

    const user = await User.findOne({ employeeId, role });
    if (!user)
      return res.status(404).json({ message: "Invalid employee ID or role" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, employeeId: user.employeeId, role: user.role },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "3h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
        email: user.email,
        department: user.department,
        location: user.location,
        address: user.address,
        designation: user.designation,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender,
        joining_date: user.joining_date,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- Create User ----------------
export const createUser = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      role,
      password,
      department,
      designation,
      location,
      address,
      phone,
      joining_date,
    } = req.body;

    if (!employeeId || !name || !email || !role || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      employeeId,
      name,
      email,
      role,
      password: hashedPassword,
      department: department || "",
      designation: designation || "",
      phone: phone || "",
      joining_date: joining_date || "",
      profileImage: req.file ? `uploads/${req.file.filename}` : "",
    });

    await newUser.save();
    res.status(201).json({ message: "User created", user: newUser });

  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- Get All Users ----------------
export const getUsers = async (req, res) => {
  try {
    let users;
    if (req.user.role === "hr") {
      users = await User.find({ role: { $ne: "admin" } }).select("-password");
    } else {
      users = await User.find().select("-password");
    }
    res.status(200).json(users);
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// ---------------- GET ONLY MANAGERS ----------------
export const getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" })
      .select("-password");

    res.status(200).json(managers);
  } catch (error) {
    console.error("Error fetching managers:", error);
    res.status(500).json({ message: "Server error while fetching managers" });
  }
};

// ---------------- Get User By ID ----------------
export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: "Invalid User ID" });

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Get User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- Update User ----------------
export const updateUser = async (req, res) => {
  const { id } = req.params;

  console.log('=== UPDATE USER START ===');
  console.log('User ID:', id);
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid ID" });

  try {
    // Find the user first
    console.log('Finding user with ID:', id);
    const user = await User.findById(id);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ message: "User not found" });
    }
    console.log('Found user:', user.name);

    // Delete old image if a new one is uploaded
    if (req.file && user.profileImage) {
      const oldImagePath = path.join(process.cwd(), user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
        console.log('Deleted old profile image:', oldImagePath);
      }
    }

    // Create updatedData object
    const updatedData = {};
    
    // Check if req.body exists before trying to access it
    if (req.body) {
      console.log('Processing form fields...');
      
      // Process form fields
      const fields = [
        'name',
        'email',
        'role',
        'department',
        'designation',
        'location',
        'address',
        'phone',
        'dob',
        'gender',
        'joining_date'
      ];

      fields.forEach(field => {
        if (req.body[field] !== undefined && req.body[field] !== '') {
          updatedData[field] = req.body[field];
          console.log(`Updated ${field}:`, req.body[field]);
        }
      });

      // Handle password separately (hash it if provided and not empty)
      if (req.body.password && req.body.password.trim() !== '') {
        try {
          updatedData.password = await bcrypt.hash(req.body.password, 10);
          console.log('Password updated');
        } catch (hashError) {
          console.error("Password hashing error:", hashError);
          return res.status(500).json({ message: "Error processing password" });
        }
      }
    }

    // Update profile image if a new one is uploaded
    if (req.file) {
      updatedData.profileImage = `uploads/${req.file.filename}`;
      console.log('Profile image updated:', updatedData.profileImage);
    }

    console.log('Final updated data:', updatedData);

    // Check if there's anything to update
    if (Object.keys(updatedData).length === 0) {
      console.log('No data to update');
      return res.status(400).json({ message: "No data provided for update" });
    }

    // Update the user
    console.log('Updating user in database...');
    const updatedUser = await User.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true, // Run model validators
    }).select("-password"); // Don't return the password

    console.log('User updated successfully:', updatedUser.name);
    console.log('=== UPDATE USER END ===');

    res.json({ message: "User updated successfully", user: updatedUser });
  } catch (err) {
    console.error("Update User Error:", err);
    console.log('=== UPDATE USER FAILED ===');
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({ message: "Validation error", errors });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      console.error('Duplicate key error for field:', field);
      return res.status(400).json({ message: `${field} already exists` });
    }
    
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ---------------- Delete User ----------------
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ message: "Invalid ID" });

  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.profileImage) {
      const imagePath = path.join(process.cwd(), user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};