import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: ['employee', 'hr', 'manager', 'admin'], 
    required: true,
    set: v => v.toLowerCase()
  },
  department: { type: String },
  designation: { type: String },
  phone: { type: String },
  profileImage: { type: String },
  location: { type: String },
  address: { type: String },
  joining_date: { type: String },
  dob: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);
export default User;
