import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getAllowedUsers,
  createOrGetConversation,
  getMyConversations,
  sendMessage,
  getMessagesByConversation,
  markMessageDelivered,
  markMessageSeen,
} from "../controllers/chatController.js";

const router = express.Router();

// ✅ Allowed Users
router.get("/allowed-users", authMiddleware, getAllowedUsers);

// ✅ Conversations
router.post("/conversation/create", authMiddleware, createOrGetConversation);
router.get("/conversation/my", authMiddleware, getMyConversations);

// ✅ Messages
router.post("/message/send", authMiddleware, sendMessage);
router.get("/message/:conversationId", authMiddleware, getMessagesByConversation);

// ✅ Status
router.post("/message/delivered", authMiddleware, markMessageDelivered);
router.post("/message/seen", authMiddleware, markMessageSeen);

export default router;
