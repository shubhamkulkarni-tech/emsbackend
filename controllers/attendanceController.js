import Attendance from "../models/Attendance.js";

/**
 * CREATE / PUNCH IN
 */
export const createAttendance = async (req, res) => {
  try {
    const { employeeId, name, date, punch_in } = req.body;

    if (!employeeId || !name || !date || !punch_in) {
      return res.status(400).json({ 
        message: "All fields are required: employeeId, name, date, punch_in" 
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const existing = await Attendance.findOne({ employeeId, date });
    if (existing) {
      return res.status(400).json({ message: "Attendance already marked for this date" });
    }

    const attendance = await Attendance.create({
      employeeId,
      name,
      date,
      punch_in,
      status: "Present",
    });

    res.status(201).json(attendance);
  } catch (error) {
    console.error("Error creating attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * LOGOUT / PUNCH OUT
 */
export const logoutAttendance = async (req, res) => {
  try {
    const { employeeId, date, punch_out, workingHours } = req.body;

    if (!employeeId || !date || !punch_out) {
      return res.status(400).json({ 
        message: "Fields required: employeeId, date, punch_out" 
      });
    }

    const attendance = await Attendance.findOne({ employeeId, date });

    if (!attendance) {
      return res.status(404).json({ message: "No record found" });
    }

    // Prevent punching out if status is not Present (e.g., Leave/Absent)
    if (attendance.status !== "Present") {
      return res.status(400).json({ message: `Cannot punch out for status: ${attendance.status}` });
    }

    if (attendance.punch_out) {
      return res.status(400).json({ message: "Already punched out" });
    }

    attendance.punch_out = punch_out;
    attendance.workingHours = workingHours; // Ideally, calculate this on backend
    await attendance.save();

    res.json(attendance);
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * MARK ABSENT / LEAVE
 */
export const markAttendance = async (req, res) => {
  try {
    const { employeeId, name, date, status } = req.body;

    if (!employeeId || !name || !date || !status) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!["Absent", "Leave"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const existing = await Attendance.findOne({ employeeId, date });
    if (existing) {
      return res.status(400).json({ message: "Record already exists" });
    }

    const attendance = await Attendance.create({
      employeeId,
      name,
      date,
      status,
      // punch_in defaults to null, workingHours defaults to null
    });

    res.status(201).json(attendance);
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * GET ALL ATTENDANCE
 */
export const getAllAttendance = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { startDate, endDate } = req.query;
    
    let filter = {};
    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const records = await Attendance.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Attendance.countDocuments(filter);
    
    res.json({
      records,
      pagination: { total, page, pages: Math.ceil(total / limit), limit }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * GET ATTENDANCE BY EMPLOYEE ID
 */
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    
    let filter = { employeeId };
    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const records = await Attendance.find(filter).sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * GENERIC UPDATE (NEW)
 * Allows correcting punch times, name, or status manually by ID
 */
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params; // MongoDB _id
    const updates = req.body;

    // Prevent updating _id or createdAt
    delete updates._id;
    delete updates.createdAt;
    delete updates.__v;

    const attendance = await Attendance.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json(attendance);
  } catch (error) {
    console.error("Error updating attendance record:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * DELETE ATTENDANCE (NEW)
 * Removes a record completely
 */
export const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findByIdAndDelete(id);

    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json({ message: "Attendance record deleted successfully" });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};