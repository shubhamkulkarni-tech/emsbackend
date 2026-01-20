import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createNotification,
  broadcastNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();

/* =========================================================
   ✅ Create Notifications
========================================================= */

// ✅ Create notification (single user)
router.post("/create", authMiddleware, createNotification);

// ✅ Broadcast notification (all users)
router.post("/broadcast", authMiddleware, broadcastNotification);

/* =========================================================
   ✅ Get Notifications
========================================================= */

// ✅ Get my notifications (pagination + filters)
router.get("/my", authMiddleware, getMyNotifications);

// ✅ Unread count
router.get("/unread-count", authMiddleware, getUnreadCount);

/* =========================================================
   ✅ Read / Delete
========================================================= */

// ✅ Mark one as read
router.patch("/read/:id", authMiddleware, markAsRead);

// ✅ Mark all read
router.patch("/read-all", authMiddleware, markAllAsRead);

// ✅ Delete one notification (soft delete)
router.delete("/:id", authMiddleware, deleteNotification);

export default router;
