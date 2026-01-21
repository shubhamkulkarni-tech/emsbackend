import User from "../models/User.js";
import Team from "../models/Team.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

/* =========================================================
   ✅ Allowed Users + Allowed Teams
========================================================= */
export const getAllowedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const me = await User.findById(userId).select("_id role name email");
    if (!me) return res.status(404).json({ message: "User not found" });

    let allowedUsers = [];
    let allowedTeams = [];

    // ✅ ADMIN -> everyone + all teams
    if (me.role === "admin") {
      allowedUsers = await User.find({ _id: { $ne: userId } }).select(
        "_id name email role"
      );

      allowedTeams = await Team.find({})
        .select("_id team_name team_leader members");
    }

    // ✅ HR -> admin + managers + employees + all teams
    else if (me.role === "hr") {
      allowedUsers = await User.find({
        _id: { $ne: userId },
        role: { $in: ["admin", "manager", "employee"] },
      }).select("_id name email role");

      allowedTeams = await Team.find({})
        .select("_id team_name team_leader members");
    }

    // ✅ MANAGER -> team employees + admin/hr + only own team
    else if (me.role === "manager") {
      const myTeam = await Team.findOne({ team_leader: userId }).select(
        "_id team_name team_leader members"
      );

      let teamEmployees = [];
      if (myTeam?.members?.length) {
        teamEmployees = myTeam.members.map((m) => m.employee);
      }

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { _id: { $in: teamEmployees } },
          { role: { $in: ["admin", "hr", "manager"] } },
        ],
      }).select("_id name email role");

      if (myTeam) allowedTeams = [myTeam];
    }

    // ✅ EMPLOYEE -> teammates + manager + HR + only their team
    else if (me.role === "employee") {
      const myTeam = await Team.findOne({
        "members.employee": userId,
      }).select("_id team_name team_leader members");

      if (!myTeam) {
        allowedUsers = await User.find({
          _id: { $ne: userId },
          role: "hr",
        }).select("_id name email role");

        return res.json({ me, allowedUsers, allowedTeams: [] });
      }

      const managerId = myTeam.team_leader;

      const teammates = (myTeam.members || [])
        .map((m) => m.employee)
        .filter((id) => id.toString() !== userId.toString());

      allowedUsers = await User.find({
        _id: { $ne: userId },
        $or: [
          { _id: { $in: teammates } },
          { _id: managerId },
          { role: "hr" },
        ],
      }).select("_id name email role");

      allowedTeams = [myTeam];
    }

    return res.json({ me, allowedUsers, allowedTeams });
  } catch (error) {
    console.log("❌ getAllowedUsers Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   ✅ Helper permission for DM
========================================================= */
const isUserAllowed = async (meId, targetId) => {
  const me = await User.findById(meId).select("_id role");
  const target = await User.findById(targetId).select("_id role");

  if (!me || !target) return false;

  if (me.role === "admin") return true;

  if (me.role === "hr") {
    return ["admin", "manager", "employee"].includes(target.role);
  }

  if (me.role === "manager") {
    if (["admin", "hr", "manager"].includes(target.role)) return true;

    const myTeam = await Team.findOne({ team_leader: meId }).select("members");
    if (!myTeam) return false;

    return (myTeam.members || []).some(
      (m) => m.employee.toString() === targetId.toString()
    );
  }

  if (me.role === "employee") {
    if (target.role === "hr") return true;

    const myTeam = await Team.findOne({ "members.employee": meId }).select(
      "team_leader members"
    );
    if (!myTeam) return false;

    if (myTeam.team_leader?.toString() === targetId.toString()) return true;

    return (myTeam.members || []).some(
      (m) => m.employee.toString() === targetId.toString()
    );
  }

  return false;
};

/* =========================================================
   ✅ Helper permission for TEAM GROUP
========================================================= */
const isTeamAllowed = async (meId, teamId) => {
  const me = await User.findById(meId).select("_id role");
  if (!me) return false;

  // ✅ Admin/HR can open any team group
  if (me.role === "admin" || me.role === "hr") return true;

  const team = await Team.findById(teamId).select("_id team_leader members");
  if (!team) return false;

  // ✅ Manager only own team
  if (me.role === "manager") {
    return team.team_leader?.toString() === meId.toString();
  }

  // ✅ Employee only their team
  if (me.role === "employee") {
    return (team.members || []).some(
      (m) => m.employee.toString() === meId.toString()
    );
  }

  return false;
};

/* =========================================================
   ✅ Create/Get DM Conversation
========================================================= */
export const createOrGetConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: "receiverId is required" });
    }

    const allowed = await isUserAllowed(meId, receiverId);
    if (!allowed) {
      return res.status(403).json({ message: "You are not allowed to chat" });
    }

    let convo = await Conversation.findOne({
      type: "dm",
      members: { $all: [meId, receiverId] },
    });

    if (!convo) {
      convo = await Conversation.create({
        type: "dm",
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

/* =========================================================
   ✅ Create/Get TEAM Conversation (Group)
========================================================= */
export const createOrGetTeamConversation = async (req, res) => {
  try {
    const meId = req.user.id;
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: "teamId is required" });
    }

    // ✅ Team fetch
    const team = await Team.findById(teamId).populate("members.employee", "_id role");
    if (!team) return res.status(404).json({ message: "Team not found" });

    const teamLeaderId = team?.team_leader?.toString();

    // ✅ Team member ids
    const memberIds = (team?.members || [])
      .map((m) => m?.employee?._id?.toString())
      .filter(Boolean);

    // ✅ allow only: admin/hr OR team leader OR team member
    const me = await User.findById(meId).select("_id role");
    const isAdminHr = ["admin", "hr"].includes((me?.role || "").toLowerCase());
    const isLeader = teamLeaderId === meId.toString();
    const isMember = memberIds.includes(meId.toString());

    if (!isAdminHr && !isLeader && !isMember) {
      return res.status(403).json({ message: "Not allowed in this team group" });
    }

    // ✅ find existing team conversation
    let convo = await Conversation.findOne({
      type: "team",
      teamId: teamId,
    });

    // ✅ create new if not found
    if (!convo) {
      convo = await Conversation.create({
        type: "team",
        teamId: teamId,
        members: [...new Set([teamLeaderId, ...memberIds])],
        lastMessage: "",
        lastMessageAt: null,
      });
    }

    return res.json(convo);
  } catch (error) {
    console.log("❌ createOrGetTeamConversation Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


/* =========================================================
   ✅ Send message (DM + TEAM)
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

    const isMember = convo.members.some(
      (id) => id.toString() === meId.toString()
    );
    if (!isMember) return res.status(403).json({ message: "Not allowed" });

    // ✅ DM permission check (only for dm)
    if (convo.type === "dm") {
      const receiverId = convo.members.find(
        (id) => id.toString() !== meId.toString()
      );
      const allowed = await isUserAllowed(meId, receiverId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not allowed to chat" });
      }
    }

    // ✅ Team permission check
    if (convo.type === "team") {
      const allowed = await isTeamAllowed(meId, convo.teamId);
      if (!allowed) {
        return res.status(403).json({ message: "Not allowed in this team" });
      }
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

    // ✅ Socket emit (DM => receiver only, TEAM => all members except me)
    const io = req.app.get("io");
    if (io) {
      if (convo.type === "dm") {
        const receiverId = convo.members.find(
          (id) => id.toString() !== meId.toString()
        );
        if (receiverId) io.to(receiverId.toString()).emit("chat:receiveMessage", msg);
      } else {
        convo.members.forEach((memberId) => {
          if (memberId.toString() !== meId.toString()) {
            io.to(memberId.toString()).emit("chat:receiveMessage", msg);
          }
        });
      }
    }

    return res.json(msg);
  } catch (error) {
    console.log("❌ sendMessage Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   ✅ Get messages of a conversation
========================================================= */
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

    // ✅ IMPORTANT: Populate senderId so frontend can show "who sent"
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate("senderId", "_id name role email");

    return res.json(messages);
  } catch (error) {
    console.log("❌ getMessagesByConversation Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
