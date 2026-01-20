import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
 
import {
  getAllowedUsers,
  createOrGetConversation,
  getMyConversations,
  sendMessage,
  getMessagesByConversation,
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

export default router;
