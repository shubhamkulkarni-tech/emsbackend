import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getAllowedUsers,
  createOrGetConversation,
  createOrGetTeamConversation,
  sendMessage,
  getMessagesByConversation,
} from "../controllers/chatController.js";

const router = express.Router();

// ✅ Allowed users + allowed teams
router.get("/allowed-users", authMiddleware, getAllowedUsers);

// ✅ Create / Get DM conversation
router.post("/conversation/create", authMiddleware, createOrGetConversation);

// ✅ Create / Get TEAM group conversation
router.post("/conversation/team/create", authMiddleware, createOrGetTeamConversation);

// ✅ Messages
router.post("/message/send", authMiddleware, sendMessage);
router.get("/message/:conversationId", authMiddleware, getMessagesByConversation);

export default router;
