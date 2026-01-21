import User from "../models/User.js";
import Team from "../models/Team.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

/* =========================================================
   ✅ Helper: Get Team of a user (based on your schema)
   - leader team: Team.team_leader === userId
   - employee team: Team.members.employee contains userId
========================================================= */
const getMyTeam = async (userId) => {
  const team = await Team.findOne({
    $or: [
      { team_leader: userId },
      { "members.employee": userId },
    ],
  })
    .select("team_leader members team_name")
    .populate("team_leader", "_id name email role")
    .populate("members.employee", "_id name email role");

  return team;
};

/* =========================================================
   ✅ Allowed Users Logic (Permission System)
========================================================= */
export const getAllowedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const me = await User.findById(userId).select("_id role name email");
    if (!me) return res.status(404).json({ message: "User not found" });

    let allowedUsers = [];

    // ✅ ADMIN -> everyone except self
    if (me.role === "admin") {
      allowedUsers = await User.find({ _id: { $ne: userId } }).select(
        "_id name email role"
      );
    }

    // ✅ HR -> everyone except self
    else if (me.role === "hr") {
      allowedUsers = await User.find({ _id: { $ne: userId } }).select(
        "_id name email role"
      );
    }

    // ✅ MANAGER (team leader) -> admin + hr + own team employees
    else if (me.role === "manager") {
      const myTeam = await Team.findOne({ team_leader: userId }).select(
        "members"
      );

      const teamEmployees =
        myTeam?.members?.map((m) => m.employee).filter(Boolean) || [];

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { role: { $in: ["admin", "hr"] } }, // ✅ admin + hr
          { _id: { $in: teamEmployees } }, // ✅ own team employees
        ],
      }).select("_id name email role");
    }

    // ✅ EMPLOYEE -> hr + team leader + teammates
    else if (me.role === "employee") {
      const myTeam = await Team.findOne({
        "members.employee": userId,
      }).select("team_leader members");

      // ✅ If employee not in team -> allow only HR
      if (!myTeam) {
        allowedUsers = await User.find({
          _id: { $ne: userId },
          role: "hr",
        }).select("_id name email role");

        return res.json({ me, allowedUsers });
      }

      const teamLeaderId = myTeam.team_leader;

      const teammates = (myTeam.members || [])
        .map((m) => m.employee)
        .filter(Boolean)
        .filter((id) => id.toString() !== userId.toString());

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { role: "hr" }, // ✅ HR
          { _id: teamLeaderId }, // ✅ Team Leader
          { _id: { $in: teammates } }, // ✅ Teammates
        ],
      }).select("_id name email role");
    }

    return res.json({ me, allowedUsers });
  } catch (error) {
    console.log("❌ getAllowedUsers Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   ✅ Helper: Permission Check (same rules)
========================================================= */
const isUserAllowed = async (meId, targetId) => {
  const me = await User.findById(meId).select("_id role");
  const target = await User.findById(targetId).select("_id role");

  if (!me || !target) return false;

  // ✅ Admin -> anyone
  if (me.role === "admin") return true;

  // ✅ HR -> anyone
  if (me.role === "hr") return true;

  // ✅ Manager -> admin + hr + own team employees
  if (me.role === "manager") {
    if (["admin", "hr"].includes(target.role)) return true;

    const myTeam = await Team.findOne({ team_leader: meId }).select("members");
    if (!myTeam) return false;

    const teamEmployees =
      myTeam.members?.map((m) => m.employee).filter(Boolean) || [];

    return teamEmployees.some((id) => id.toString() === targetId.toString());
  }

  // ✅ Employee -> hr + team leader + teammates
  if (me.role === "employee") {
    if (target.role === "hr") return true;

    const myTeam = await Team.findOne({ "members.employee": meId }).select(
      "team_leader members"
    );
    if (!myTeam) return false;

    // ✅ leader allowed
    if (myTeam.team_leader?.toString() === targetId.toString()) return true;

    // ✅ teammates allowed
    const teammates =
      myTeam.members?.map((m) => m.employee).filter(Boolean) || [];

    return teammates.some((id) => id.toString() === targetId.toString());
  }

  return false;
};

/* =========================================================
   ✅ Conversation APIs
========================================================= */
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

    // ✅ Create new
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

    // ✅ Find receiver
    const receiverId = convo.members.find(
      (id) => id.toString() !== meId.toString()
    );

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

    // ✅ Emit realtime
    const io = req.app.get("io");
    if (io && receiverId) {
      io.to(receiverId.toString()).emit("chat:receiveMessage", msg);
    }

    return res.json(msg);
  } catch (error) {
    console.log("❌ sendMessage Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { conversationId } = req.params;

    const convo = await Conversation.findById(conversationId);
    if (!convo)
      return res.status(404).json({ message: "Conversation not found" });

    // ✅ Ensure member
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
