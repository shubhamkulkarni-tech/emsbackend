import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  taskId: {
    type: Number,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team"
  },
  startDate: {
    type: Date
  },
  dueDate: {
    type: Date,
    required: true
  },
  estimatedHours: {
    type: Number,
    min: 0
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High", "Critical"],
    default: "Medium"
  },
  status: {
    type: String,
    enum: ["Not Started", "In Progress", "On Hold", "Completed", "In Review"],
    default: "Not Started"
  },
  category: {
    type: String,
    enum: ["Development", "Design", "Testing", "Documentation", "Meeting", "Research"],
    default: "Development"
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  progressStatus: {
    type: String,
    enum: ["", "Pending", "Completed"],
    default: ""
  },
  tags: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  attachments: [{
    filename: String,
    path: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  notifyAssignee: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

export default mongoose.model("Task", taskSchema);














// import mongoose from "mongoose";

// const taskSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   assignedTo: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },
//   team: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Team"
//   },
//   startDate: {
//     type: Date
//   },
//   dueDate: {
//     type: Date,
//     required: true
//   },
//   estimatedHours: {
//     type: Number,
//     min: 0
//   },
//   priority: {
//     type: String,
//     enum: ["Low", "Medium", "High", "Critical"],
//     default: "Medium"
//   },
//   status: {
//     type: String,
//     enum: ["Not Started", "In Progress", "On Hold", "Completed", "In Review"],
//     default: "Not Started"
//   },
//   category: {
//     type: String,
//     enum: ["Development", "Design", "Testing", "Documentation", "Meeting", "Research"],
//     default: "Development"
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   tags: {
//     type: String,
//     trim: true
//   },
//   notes: {
//     type: String,
//     trim: true
//   },
//   attachments: [{
//     filename: String,
//     path: String,
//     uploadDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   notifyAssignee: {
//     type: Boolean,
//     default: true
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User"
//   }
// }, {
//   timestamps: true
// });

// export default mongoose.model("Task", taskSchema);



// import mongoose from "mongoose";

// const taskSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     trim: true
//   },

//   // 🔧 CHANGED: ObjectId ➜ String (employeeId like "25101771")
//   assignedTo: {
//     type: String,
//     required: true,
//     trim: true
//   },

//   team: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Team"
//   },
//   startDate: {
//     type: Date
//   },
//   dueDate: {
//     type: Date,
//     required: true
//   },
//   estimatedHours: {
//     type: Number,
//     min: 0
//   },
//   priority: {
//     type: String,
//     enum: ["Low", "Medium", "High", "Critical"],
//     default: "Medium"
//   },
//   status: {
//     type: String,
//     enum: ["Not Started", "In Progress", "On Hold", "Completed", "In Review"],
//     default: "Not Started"
//   },
//   category: {
//     type: String,
//     enum: ["Development", "Design", "Testing", "Documentation", "Meeting", "Research"],
//     default: "Development"
//   },
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
//   tags: {
//     type: String,
//     trim: true
//   },
//   notes: {
//     type: String,
//     trim: true
//   },
//   attachments: [{
//     filename: String,
//     path: String,
//     uploadDate: {
//       type: Date,
//       default: Date.now
//     }
//   }],
//   notifyAssignee: {
//     type: Boolean,
//     default: true
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User"
//   }
// }, {
//   timestamps: true
// });

// export default mongoose.model("Task", taskSchema);
