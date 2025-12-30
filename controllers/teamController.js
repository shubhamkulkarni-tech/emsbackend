

import Team from "../models/Team.js";

//Create Team
export const createTeam = async (req, res) => {
  try {
    const { team_name, team_leader_id, member_ids } = req.body;

    if (!team_name || !team_leader_id) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const members = (member_ids || []).map(id => ({
      employee: id
    }));

    const team = await Team.create({
      team_name,
      team_leader: team_leader_id,
      members
    });

    res.status(201).json(team);
  } catch (error) {
    console.error("Create Team Error:", error);
    res.status(500).json({ message: "Failed to create team" });
  }
};

// Get All Teams
export const getTeams = async (req, res) => {
  try {
    let teams;
    const userRole = req.user.role?.toLowerCase();
    const userId = req.user._id;

    // Admin sees all teams
    if (userRole === "admin") {
      teams = await Team.find()
        .populate("team_leader", "name role _id")
        .populate("members.employee", "name role _id");
    } else {
      // For employees, managers, and HR: only show teams where they are team_leader OR a member
      teams = await Team.find({
        $or: [
          { team_leader: userId },
          { "members.employee": userId }
        ]
      })
        .populate("team_leader", "name role _id")
        .populate("members.employee", "name role _id");
    }

    res.json(teams);
  } catch (error) {
    console.error("Get Teams Error:", error);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
};

//  Get Team By ID
export const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate("team_leader", "name role _id")
      .populate("members.employee", "name role _id");

    if (!team) return res.status(404).json({ message: "Team not found" });

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch team" });
  }
};

//  Update Team
export const updateTeam = async (req, res) => {
  try {
    const { team_name, team_leader_id, member_ids } = req.body;

    const members = (member_ids || []).map(id => ({
      employee: id
    }));

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      {
        team_name,
        team_leader: team_leader_id,
        members
      },
      { new: true }
    );

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: "Failed to update team" });
  }
};

// Delete Team
export const deleteTeam = async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete team" });
  }
};
