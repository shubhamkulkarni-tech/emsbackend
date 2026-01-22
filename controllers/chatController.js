import User from "../models/User.js";
import Team from "../models/Team.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import cloudinary from "../config/cloudinary.js";

/* =========================================================
   ALLOWED USERS + TEAMS
========================================================= */
export const getAllowedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const me = await User.findById(userId).select("_id role name email");
    if (!me) return res.status(404).json({ message: "User not found" });

    let allowedUsers = [];
    let allowedTeams = [];

    // ADMIN / HR
    if (me.role === "admin" || me.role === "hr") {
      allowedUsers = await User.find({ _id: { $ne: userId } }).select(
        "_id name email role"
      );

      allowedTeams = await Team.find({}).select(
        "_id team_name team_leader members"
      );
    }

    // MANAGER
    else if (me.role === "manager") {
      const myTeams = await Team.find({ team_leader: userId }).select(
        "_id team_name team_leader members"
      );

      const employeeIds = myTeams.flatMap((t) =>
        (t.members || []).map((m) => m.employee)
      );

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { role: "hr" },
          { role: "admin" },
          { _id: { $in: employeeIds } },
        ],
      }).select("_id name email role");

      allowedTeams = myTeams;
    }

    // EMPLOYEE
    else if (me.role === "employee") {
      const myTeams = await Team.find({
        "members.employee": userId,
      }).select("_id team_name team_leader members");

      if (!myTeams.length) {
        allowedUsers = await User.find({ role: "hr" }).select(
          "_id name email role"
        );
        return res.json({ me, allowedUsers, allowedTeams: [] });
      }

      const myTeam = myTeams[0];
      const managerId = myTeam.team_leader;

      const teammateIds = myTeam.members
        .map((m) => m.employee.toString())
        .filter((id) => id !== userId.toString());

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { role: "hr" },
          { _id: managerId },
          { _id: { $in: teammateIds } },
        ],
      }).select("_id name email role");

      allowedTeams = myTeams;
    }

    return res.json({ me, allowedUsers, allowedTeams });
  } catch (error) {
    console.log("❌ getAllowedUsers Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   PERMISSION HELPERS
========================================================= */
const isUserAllowed = async (meId, targetId) => {
  const me = await User.findById(meId);
  const target = await User.findById(targetId);
  if (!me || !target) return false;

  if (["admin", "hr"].includes(me.role)) return true;

  if (me.role === "manager") {
    if (["admin", "hr"].includes(target.role)) return true;
    const teams = await Team.find({ team_leader: meId });
    return teams.some((t) =>
      (t.members || []).some(
        (m) => m.employee.toString() === targetId.toString()
      )
    );
  }

  if (me.role === "employee") {
    if (target.role === "hr") return true;
    const team = await Team.findOne({ "members.employee": meId });
    if (!team) return false;

    return (
      team.team_leader?.toString() === targetId.toString() ||
      team.members.some(
        (m) => m.employee.toString() === targetId.toString()
      )
    );
  }

  return false;
};

const isTeamAllowed = async (meId, teamId) => {
  const me = await User.findById(meId);
  if (!me) return false;

  if (["admin", "hr"].includes(me.role)) return true;

  const team = await Team.findById(teamId);
  if (!team) return false;

  if (me.role === "manager")
    return team.team_leader?.toString() === meId.toString();

  if (me.role === "employee")
    return team.members.some(
      (m) => m.employee.toString() === meId.toString()
    );

  return false;
};

/* =========================================================
   CREATE / GET CONVERSATIONS
========================================================= */
export const createOrGetConversation = async (req, res) => {
  const { receiverId } = req.body;
  const meId = req.user.id;

  if (!(await isUserAllowed(meId, receiverId)))
    return res.status(403).json({ message: "Not allowed" });

  let convo = await Conversation.findOne({
    type: "dm",
    members: { $all: [meId, receiverId] },
  });

  if (!convo) {
    convo = await Conversation.create({
      type: "dm",
      members: [meId, receiverId],
    });
  }

  res.json(convo);
};

export const createOrGetTeamConversation = async (req, res) => {
  const { teamId } = req.body;
  const meId = req.user.id;

  if (!(await isTeamAllowed(meId, teamId)))
    return res.status(403).json({ message: "Not allowed" });

  let convo = await Conversation.findOne({ type: "team", teamId });

  if (!convo) {
    const team = await Team.findById(teamId);

    convo = await Conversation.create({
      type: "team",
      teamId,
      members: [
        team.team_leader,
        ...(team.members || []).map((m) => m.employee),
      ].filter(Boolean),
    });
  }

  res.json(convo);
};

/* =========================================================
   SEND MESSAGE (TEXT + FILE) ✅ FINAL SAFE VERSION
========================================================= */
export const sendMessage = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const meId = String(req.user.id);
    const { conversationId, text } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId missing" });
    }

    const convo = await Conversation.findById(conversationId);
    if (!convo || !Array.isArray(convo.members)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    let fileData = null;

    // FILE UPLOAD
    if (req.file) {
      try {
        const uploadRes = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${req.file.buffer.toString(
            "base64"
          )}`,
          { folder: "ems-chat", resource_type: "auto" }
        );

        fileData = {
          url: uploadRes.secure_url,
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size,
        };
      } catch (err) {
        console.error("❌ Cloudinary error:", err);
        return res.status(500).json({ message: "File upload failed" });
      }
    }

    const msg = await Message.create({
      conversationId,
      senderId: meId,
      text: text || "",
      file: fileData,
      status: "sent",
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text || (fileData ? "📎 File" : ""),
      lastMessageAt: new Date(),
    });

    const io = req.app.get("io");

    if (io) {
      convo.members.forEach((m) => {
        if (!m) return;
        const memberId = String(m);
        if (memberId !== meId) {
          io.to(memberId).emit("chat:receiveMessage", msg);
        }
      });
    }

    return res.json(msg);
  } catch (error) {
    console.error("❌ sendMessage FINAL error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================================================
   GET MESSAGES + DELIVERED
========================================================= */
export const getMessagesByConversation = async (req, res) => {
  const meId = req.user.id;
  const { conversationId } = req.params;

  await Message.updateMany(
    { conversationId, senderId: { $ne: meId }, status: "sent" },
    { status: "delivered" }
  );

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .populate("senderId", "_id name role email");

  res.json(messages);
};

/* =========================================================
   MARK SEEN
========================================================= */
export const markConversationSeen = async (req, res) => {
  const meId = req.user.id;
  const { conversationId } = req.body;

  await Message.updateMany(
    { conversationId, senderId: { $ne: meId } },
    { status: "seen" }
  );

  res.json({ success: true });
};
