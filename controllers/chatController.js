import User from "../models/User.js";
import Team from "../models/Team.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";

/* =========================================================
   ✅ Allowed Users Logic (Permission System)
========================================================= */
export const getAllowedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const me = await User.findById(userId).select("_id role name email");
    if (!me) return res.status(404).json({ message: "User not found" });

    let allowedUsers = [];

    // ✅ ADMIN + HR -> can chat with anyone
    if (me.role === "admin" || me.role === "hr") {
      allowedUsers = await User.find({ _id: { $ne: userId } }).select(
        "_id name email role"
      );
      return res.json({ me, allowedUsers });
    }

    // ✅ MANAGER -> only own team employees + HR
    if (me.role === "manager") {
      const myTeam = await Team.findOne({ manager: userId }).select("employees");
      const teamEmployees = myTeam?.employees || [];

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { _id: { $in: teamEmployees } }, // ✅ own employees
          { role: "hr" }, // ✅ HR
        ],
      }).select("_id name email role");

      return res.json({ me, allowedUsers });
    }

    // ✅ EMPLOYEE -> only teammates + manager + HR
    if (me.role === "employee") {
      const myTeam = await Team.findOne({ employees: userId }).select(
        "manager employees"
      );

      // ✅ no team -> allow only HR
      if (!myTeam) {
        allowedUsers = await User.find({
          _id: { $ne: userId },
          role: "hr",
        }).select("_id name email role");

        return res.json({ me, allowedUsers });
      }

      const managerId = myTeam?.manager;
      const teammates = (myTeam?.employees || []).filter(
        (id) => id.toString() !== userId.toString()
      );

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { _id: { $in: teammates } }, // ✅ teammates
          { _id: managerId }, // ✅ manager
          { role: "hr" }, // ✅ hr
        ],
      }).select("_id name email role");

      return res.json({ me, allowedUsers });
    }

    return res.json({ me, allowedUsers: [] });
  } catch (error) {
    console.log("❌ getAllowedUsers Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   ✅ Helper: Check permission
========================================================= */
const isUserAllowed = async (meId, targetId) => {
  const me = await User.findById(meId).select("_id role");
  const target = await User.findById(targetId).select("_id role");

  if (!me || !target) return false;

  // ✅ Admin / HR -> all allowed
  if (me.role === "admin" || me.role === "hr") return true;

  // ✅ Manager -> only own employees + HR
  if (me.role === "manager") {
    if (target.role === "hr") return true;

    const myTeam = await Team.findOne({ manager: meId }).select("employees");
    if (!myTeam) return false;

    return myTeam.employees.some((id) => id.toString() === targetId.toString());
  }

  // ✅ Employee -> teammates + manager + HR
  if (me.role === "employee") {
    if (target.role === "hr") return true;

    const myTeam = await Team.findOne({ employees: meId }).select(
      "manager employees"
    );
    if (!myTeam) return false;

    // ✅ manager allowed
    if (myTeam.manager?.toString() === targetId.toString()) return true;

    // ✅ teammate allowed
    return myTeam.employees.some((id) => id.toString() === targetId.toString());
  }

  return false;
};

/* =========================================================
   ✅ Conversation APIs
========================================================= */

// ✅ Create / Get conversation
export const createOrGetConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: "receiverId is required" });
    }

    // ✅ Permission check
    const allowed = await isUserAllowed(meId, receiverId);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to chat" });
    }

    // ✅ Find existing conversation
    let convo = await Conversation.findOne({
      members: { $all: [meId, receiverId] },
    });

    // ✅ Create new conversation
    if (!convo) {
      convo = await Conversation.create({
        members: [meId, receiverId],
        lastMessage: "",
        lastMessageAt: null,
      });
    }

    return res.json(convo);
  } catch (error) {
    console.log("❌ createOrGetConversation Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get my conversation list
export const getMyConversations = async (req, res) => {
  try {
    const meId = req.user.id;

    const conversations = await Conversation.find({
      members: { $in: [meId] },
    })
      .sort({ updatedAt: -1 })
      .populate("members", "_id name email role");

    return res.json(conversations);
  } catch (error) {
    console.log("❌ getMyConversations Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   ✅ Message APIs
========================================================= */

// ✅ Send message (DB + Socket + Notification)
export const sendMessage = async (req, res) => {
  try {
    const meId = req.user.id;
    const { conversationId, text } = req.body;

    if (!conversationId || !text) {
      return res
        .status(400)
        .json({ message: "conversationId and text are required" });
    }

    const convo = await Conversation.findById(conversationId);
    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });

    // ✅ Ensure sender is member
    const isMember = convo.members.some(
      (id) => id.toString() === meId.toString()
    );
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    // ✅ receiver = other member
    const receiverId = convo.members.find(
      (id) => id.toString() !== meId.toString()
    );
    if (!receiverId)
      return res.status(400).json({ message: "Receiver not found" });

    // ✅ Permission check
    const allowed = await isUserAllowed(meId, receiverId);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to chat" });
    }

    // ✅ Save message
    const msg = await Message.create({
      conversationId,
      senderId: meId,
      text,
      status: "sent",
    });

    // ✅ Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text,
      lastMessageAt: new Date(),
    });

    // ✅ Create notification for receiver
    const senderUser = await User.findById(meId).select("_id name role");

    const noti = await Notification.create({
      userId: receiverId,
      type: "chat",
      title: "New Message",
      message: `${senderUser?.name || "Someone"}: ${text}`,
      data: {
        conversationId,
        senderId: meId,
      },
      isRead: false,
    });

    // ✅ Socket emit (realtime)
    const io = req.app.get("io");
    if (io) {
      // ✅ message to receiver
      io.to(receiverId.toString()).emit("chat:receiveMessage", msg);

      // ✅ notification to receiver
      io.to(receiverId.toString()).emit("notification:new", noti);

      // ✅ unread count update
      const unreadCount = await Notification.countDocuments({
        userId: receiverId,
        isRead: false,
      });

      io.to(receiverId.toString()).emit("notification:unreadCount", {
        unreadCount,
      });
    }

    return res.json(msg);
  } catch (error) {
    console.log("❌ sendMessage Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get messages of conversation
export const getMessagesByConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { conversationId } = req.params;

    const convo = await Conversation.findById(conversationId);
    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });

    const isMember = convo.members.some(
      (id) => id.toString() === meId.toString()
    );
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    return res.json(messages);
  } catch (error) {
    console.log("❌ getMessagesByConversation Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   ✅ Delivered & Seen APIs (WhatsApp style ✅)
========================================================= */

// ✅ Mark delivered
export const markMessageDelivered = async (req, res) => {
  try {
    const meId = req.user.id;
    const { messageId } = req.body;

    if (!messageId)
      return res.status(400).json({ message: "messageId is required" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const convo = await Conversation.findById(msg.conversationId);
    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });

    const isMember = convo.members.some(
      (id) => id.toString() === meId.toString()
    );
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    // ✅ only if sent
    if (msg.status === "sent") {
      msg.status = "delivered";
      await msg.save();
    }

    // ✅ emit to both users
    const io = req.app.get("io");
    if (io) {
      convo.members.forEach((memberId) => {
        io.to(memberId.toString()).emit("chat:messageStatusUpdated", {
          messageId: msg._id,
          status: msg.status,
        });
      });
    }

    return res.json({ messageId: msg._id, status: msg.status });
  } catch (error) {
    console.log("❌ markMessageDelivered Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Mark seen
export const markMessageSeen = async (req, res) => {
  try {
    const meId = req.user.id;
    const { messageId } = req.body;

    if (!messageId)
      return res.status(400).json({ message: "messageId is required" });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const convo = await Conversation.findById(msg.conversationId);
    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });

    const isMember = convo.members.some(
      (id) => id.toString() === meId.toString()
    );
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    if (msg.status !== "seen") {
      msg.status = "seen";
      await msg.save();
    }

    // ✅ emit to both users
    const io = req.app.get("io");
    if (io) {
      convo.members.forEach((memberId) => {
        io.to(memberId.toString()).emit("chat:messageStatusUpdated", {
          messageId: msg._id,
          status: msg.status,
        });
      });
    }

    return res.json({ messageId: msg._id, status: msg.status });
  } catch (error) {
    console.log("❌ markMessageSeen Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
