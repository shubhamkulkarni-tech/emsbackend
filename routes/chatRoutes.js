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
   ALLOWED USERS + TEAMS
========================================================= */
router.get("/allowed-users", auth, getAllowedUsers);

/* =========================================================
   CONVERSATIONS
========================================================= */

// DM conversation
router.post("/conversation/create", auth, createOrGetConversation);

// Team group conversation
router.post(
  "/conversation/team/create",
  auth,
  createOrGetTeamConversation
);

/* =========================================================
   MESSAGES
========================================================= */

router.post(
  "/message/send",
  auth,
  upload.single("file"), // ✅ IMPORTANT
  sendMessage
);

// Get messages of a conversation
router.get(
  "/message/:conversationId",
  auth,
  getMessagesByConversation
);

// Mark conversation as seen (read receipt)
router.post(
  "/message/seen",
  auth,
  markConversationSeen
);

export default router;
