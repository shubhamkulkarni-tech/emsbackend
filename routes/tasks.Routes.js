import express from "express";
import { 
  getTasks, 
  getMyTasks, 
<<<<<<< HEAD
  getTaskById,
  addTask, 
  updateTask, 
  deleteTask, 
  acceptTask,
  submitTaskForReview,
  reviewTask,
  getTeamMembers
=======
  getTeamMembers, 
  addTask, 
  updateTask, 
  deleteTask, 
  getTaskById, 
  deleteAttachment, 
  updateProgressStatus,
  // Add the new workflow functions
  acceptTask,
  submitTaskForReview,
  reviewTask
>>>>>>> 69a1868ebc54e916510eeccf928179d6600d558d
} from "../controllers/taskController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();

// Configure Multer for file uploads
const upload = multer({
  dest: 'uploads/', // Save files to the 'uploads' directory
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
  fileFilter: (req, file, cb) => {
    // Optional: Add file type filter if needed
    cb(null, true);
  }
});

// Apply authentication middleware to all routes
router.use(authMiddleware);

<<<<<<< HEAD
// Main CRUD and filtering routes
router.route("/")
  .get(getTasks)
  .post(upload.array('attachments', 5), addTask); // Allow up to 5 attachments

router.get("/my-tasks", getMyTasks);
router.get("/team-members", getTeamMembers);

// Routes for a specific task by ID
router.route("/:id")
  .get(getTaskById)
  .put(upload.array('attachments', 5), updateTask) // Allow attachments on update
  .delete(deleteTask);

// Workflow-specific routes
router.put("/:id/accept", acceptTask);
router.put("/:id/submit", submitTaskForReview);
router.put("/:id/review", reviewTask);

=======
router.get("/", authMiddleware, getTasks);
router.get("/my-tasks", authMiddleware, getMyTasks);
router.get("/team-members", authMiddleware, getTeamMembers);
router.get("/:id", authMiddleware, getTaskById);
router.post("/", authMiddleware, upload.array('attachments', 5), addTask);
router.post("/add", authMiddleware, upload.array('attachments', 5), addTask);
router.put("/:id", authMiddleware, upload.array('attachments', 5), updateTask);
router.put("/:id/progress", authMiddleware, updateProgressStatus);

// Add the new workflow routes
router.put("/:id/accept", authMiddleware, acceptTask);
router.put("/:id/submit", authMiddleware, submitTaskForReview);
router.put("/:id/review", authMiddleware, reviewTask);

router.delete("/:id", authMiddleware, deleteTask);
router.delete("/:id/attachments/:attachmentId", authMiddleware, deleteAttachment);

>>>>>>> 69a1868ebc54e916510eeccf928179d6600d558d
export default router;