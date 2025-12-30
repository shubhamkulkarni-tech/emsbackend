import express from "express";
import { getTasks, getMyTasks, getTeamMembers, addTask, updateTask, deleteTask, getTaskById, deleteAttachment, updateProgressStatus } from "../controllers/taskController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

router.get("/", authMiddleware, getTasks);
router.get("/my-tasks", authMiddleware, getMyTasks);
router.get("/team-members", authMiddleware, getTeamMembers);
router.get("/:id", authMiddleware, getTaskById);
router.post("/", authMiddleware, upload.array('attachments', 5), addTask);
router.post("/add", authMiddleware, upload.array('attachments', 5), addTask);
router.put("/:id", authMiddleware, upload.array('attachments', 5), updateTask);
router.put("/:id/progress", authMiddleware, updateProgressStatus);
router.delete("/:id", authMiddleware, deleteTask);
router.delete("/:id/attachments/:attachmentId", authMiddleware, deleteAttachment);

export default router;




// import express from "express";
// import { getTasks, getMyTasks, getTeamMembers, addTask, updateTask, deleteTask } from "../controllers/taskController.js";
// import authMiddleware from "../middleware/authMiddleware.js";

// const router = express.Router();

// router.get("/", authMiddleware, getTasks);
// router.get("/my-tasks", authMiddleware, getMyTasks);
// router.get("/team-members", authMiddleware, getTeamMembers);
// router.post("/", authMiddleware, addTask);
// router.post("/add", authMiddleware, addTask); // Keep for backward compatibility
// router.put("/:id", authMiddleware, updateTask);
// router.delete("/:id", authMiddleware, deleteTask);

// export default router;
