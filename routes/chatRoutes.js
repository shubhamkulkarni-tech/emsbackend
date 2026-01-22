import express from "express";
import auth from "../middleware/authMiddleware.js";
import upload from "../utils/upload.js";

import {
  getAllowedUsers,
  createOrGetConversation,
  createOrGetTeamConversation,
  sendMessage,
  getMessagesByConversation,
  markConversationSeen,
} from "../controllers/chatController.js";

const router = express.Router();

/* =========================================================
   ✅ ALLOWED USERS + TEAMS
========================================================= */
router.get("/allowed-users", auth, getAllowedUsers);

/* =========================================================
   ✅ CONVERSATIONS
========================================================= */

// Direct Message (DM)
router.post(
  "/conversation/create",
  auth,
  createOrGetConversation
);

// Team Group Conversation
router.post(
  "/conversation/team/create",
  auth,
  createOrGetTeamConversation
);

/* =========================================================
   ✅ MESSAGES
========================================================= */

// Send message (text + file upload)
router.post(
  "/message/send",
  auth,
  upload.single("file"), // 👈 Cloudinary + Multer
  sendMessage
);

// Get all messages of a conversation
router.get(
  "/message/:conversationId",
  auth,
  getMessagesByConversation
);

// Mark messages as seen (read receipt)
router.post(
  "/message/seen",
  auth,
  markConversationSeen
);

export default router;
