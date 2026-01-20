import User from "../models/User.js";
import Team from "../models/Team.js";

export const getAllowedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const me = await User.findById(userId).select("_id role name email");
    if (!me) return res.status(404).json({ message: "User not found" });

    let allowedUsers = [];

    // ✅ ADMIN -> all
    if (me.role === "admin") {
      allowedUsers = await User.find({ _id: { $ne: userId } }).select("_id name email role");
    }

    // ✅ HR -> admin + manager + employee
    else if (me.role === "hr") {
      allowedUsers = await User.find({
        _id: { $ne: userId },
        role: { $in: ["admin", "manager", "employee"] },
      }).select("_id name email role");
    }

    // ✅ MANAGER -> own team employees + other managers + hr + admin
    else if (me.role === "manager") {
      const myTeam = await Team.findOne({ manager: userId }).select("employees");
      const teamEmployees = myTeam?.employees || [];

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { _id: { $in: teamEmployees } },
          { role: { $in: ["admin", "hr", "manager"] } },
        ],
      }).select("_id name email role");
    }

    // ✅ EMPLOYEE -> teammates + manager + HR
    else if (me.role === "employee") {
      const myTeam = await Team.findOne({ employees: userId }).select("manager employees");

      const managerId = myTeam?.manager;
      const teammates = (myTeam?.employees || []).filter(
        (id) => id.toString() !== userId.toString()
      );

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { _id: { $in: teammates } },
          { _id: managerId },
          { role: "hr" },
        ],
      }).select("_id name email role");
    }

    return res.json({ me, allowedUsers });
  } catch (err) {
    console.log("❌ Allowed Users Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
const isUserAllowed = async (meId, targetId) => {
  const me = await User.findById(meId).select("_id role");
  const target = await User.findById(targetId).select("_id role");

  if (!me || !target) return false;

  // ✅ Admin -> everyone
  if (me.role === "admin") return true;

  // ✅ HR -> admin/manager/employee
  if (me.role === "hr") {
    return ["admin", "manager", "employee"].includes(target.role);
  }

  // ✅ Manager -> own team employees + other managers + hr + admin
  if (me.role === "manager") {
    if (["admin", "hr", "manager"].includes(target.role)) return true;

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

    // ✅ manager
    if (myTeam.manager?.toString() === targetId.toString()) return true;

    // ✅ teammates
    return myTeam.employees.some((id) => id.toString() === targetId.toString());
  }

  return false;
};

// ✅ 1) Create/Get Conversation
export const createOrGetConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: "receiverId is required" });
    }

    // ✅ permission check
    const allowed = await isUserAllowed(meId, receiverId);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to chat" });
    }

    // ✅ find existing convo
    let convo = await Conversation.findOne({
      members: { $all: [meId, receiverId] },
    });

    // ✅ create new convo
    if (!convo) {
      convo = await Conversation.create({
        members: [meId, receiverId],
        lastMessage: "",
        lastMessageAt: null,
      });
    }

    return res.json(convo);
  } catch (err) {
    console.log("❌ createOrGetConversation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 2) My Conversations
export const getMyConversations = async (req, res) => {
  try {
    const meId = req.user.id;

    const conversations = await Conversation.find({
      members: { $in: [meId] },
    })
      .sort({ updatedAt: -1 })
      .populate("members", "_id name email role");

    return res.json(conversations);
  } catch (err) {
    console.log("❌ getMyConversations error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 3) Send Message
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
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    // ✅ check sender is member
    const isMember = convo.members.some((id) => id.toString() === meId.toString());
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    // ✅ find receiver (other member)
    const receiverId = convo.members.find((id) => id.toString() !== meId.toString());

    // ✅ permission check with receiver
    const allowed = await isUserAllowed(meId, receiverId);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to chat" });
    }

    const msg = await Message.create({
      conversationId,
      senderId: meId,
      text,
      status: "sent",
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text,
      lastMessageAt: new Date(),
    });

    // ✅ Socket emit (optional now, later realtime)
    const io = req.app.get("io");
    if (io) {
      io.to(receiverId.toString()).emit("receiveMessage", msg);
    }

    return res.json(msg);
  } catch (err) {
    console.log("❌ sendMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ 4) Get Messages of Conversation
export const getMessagesByConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { conversationId } = req.params;

    const convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    // ✅ check member
    const isMember = convo.members.some((id) => id.toString() === meId.toString());
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    console.log("❌ getMessagesByConversation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};