// backend/controllers/projectController.js
import Project from "../models/Project.js";
import Team from "../models/Team.js";
import User from "../models/User.js";

/**
 * Generate a random 8-digit project ID
 */
const generateProjectId = () => {
  // Generate a random number between 10000000 and 99999999
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Create Project
 */
export const createProject = async (req, res) => {
  try {
    const { project_name, description, manager_id, end_date, status, team_id, deadline } = req.body;

    if (!project_name || !manager_id) {
      return res.status(400).json({ message: "Project name and manager are required" });
    }

    // Generate a unique 8-digit project_id if not provided
    let projectId = req.body.project_id;
    if (!projectId) {
      // Keep generating until we find a unique ID
      let isUnique = false;
      while (!isUnique) {
        projectId = generateProjectId();
        const existingProject = await Project.findOne({ project_id: projectId });
        if (!existingProject) {
          isUnique = true;
        }
      }
    }

    const project = await Project.create({
      project_name,
      project_id: projectId, // Use the 8-digit format
      description: description || "",
      manager: manager_id,
      team: team_id || null,
      status: status || "In Progress",
      end_date: end_date || null,
      deadline: deadline || null,
    });

    await project.populate("manager", "name email role");
    await project.populate("team", "team_name");

    res.status(201).json({ message: "Project created successfully", project });
  } catch (err) {
    console.error("Create Project Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get Projects (with filters & summary)
 */
export const getProjects = async (req, res) => {
  try {
    const {
      search,
      status,
      manager,
      team,
      from, // start date lower bound (projects with deadline >= from)
      to, // end date upper bound (projects with deadline <= to)
      page = 1,
      limit = 12,
      sortBy = "createdAt",
      sortDir = "desc",
    } = req.query;

    const userRole = req.user.role?.toLowerCase();
    const userId = req.user._id;

    const q = {};

    // Role-based filtering: Only show projects of teams the user belongs to
    if (userRole !== "admin") {
      // Find teams where user is team_leader OR a member
      const userTeams = await Team.find({
        $or: [
          { team_leader: userId },
          { "members.employee": userId }
        ]
      }).select("_id");

      const userTeamIds = userTeams.map(t => t._id);

      // If team filter is provided, verify user has access to that team
      if (team) {
        if (!userTeamIds.some(id => id.toString() === team.toString())) {
          // User doesn't have access to this team - return empty results
          return res.status(200).json({ projects: [], summary: { total: 0, completed: 0, inProgress: 0, onHold: 0 } });
        }
        // User has access, filter by this specific team
        q.team = team;
      } else {
        // No team filter: show projects of all user's teams
        // Also include projects where user is the manager (for managers)
        if (userRole === "manager") {
          q.$or = [
            { team: { $in: userTeamIds } },
            { manager: userId }
          ];
        } else {
          // For employees/HR: only projects of their teams
          q.team = { $in: userTeamIds };
        }
      }
    } else {
      // Admin: can filter by any team
      if (team) q.team = team;
    }

    // Apply additional filters
    if (status) q.status = status;
    if (manager) q.manager = manager;

    // date range on deadline (frontend expects this field)
    if (from || to) {
      q.deadline = {};
      if (from) q.deadline.$gte = new Date(from);
      if (to) q.deadline.$lte = new Date(to);
    }

    // text search in project_name or project_id or manager name
    if (search) {
      q.$or = [
        { project_name: { $regex: search, $options: "i" } },
        { project_id: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Math.max(parseInt(page, 10), 1) - 1) * Math.max(parseInt(limit, 10), 1);
    const sort = { [sortBy]: sortDir === "asc" ? 1 : -1 };

    // Fetch projects with population
    let projects = await Project.find(q)
      .populate("manager", "name email role")
      .populate("team", "team_name")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10));

    // If search matches manager name but project_name/project_id didn't match, also include those
    if (search) {
      // find managers whose name matches
      const managers = await User.find({ name: { $regex: search, $options: "i" } }).select("_id");
      const managerIds = managers.map((m) => m._id.toString());
      if (managerIds.length > 0) {
        // Apply same role-based filtering for search results
        const searchQuery = { ...q, manager: { $in: managerIds } };
        delete searchQuery.$or; // Remove the existing $or for project_name/project_id search
        
        const extra = await Project.find(searchQuery)
          .populate("manager", "name email role")
          .populate("team", "team_name")
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit, 10));
          
        // merge unique by id
        const map = new Map(projects.map((p) => [p._id.toString(), p]));
        extra.forEach((p) => {
          if (!map.has(p._id.toString())) map.set(p._id.toString(), p);
        });
        projects = Array.from(map.values());
      }
    }

    // Build summary counts across all matching projects (ignores pagination)
    const allMatching = await Project.find(q)
      .populate("manager", "name")
      .populate("team", "team_name");

    const total = allMatching.length;
    const completed = allMatching.filter((p) => p.status === "Completed").length;
    const inProgress = allMatching.filter((p) => p.status === "In Progress").length;
    const onHold = allMatching.filter((p) => p.status === "On Hold").length;

    const summary = {
      total,
      completed,
      inProgress,
      onHold,
    };

    res.status(200).json({ projects, summary });
  } catch (err) {
    console.error("Get Projects Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get project by id
 */
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("manager", "name email role")
      .populate("team", "team_name");

    if (!project) return res.status(404).json({ message: "Project not found" });
    res.status(200).json(project);
  } catch (err) {
    console.error("Get Project Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update Project
 */
export const updateProject = async (req, res) => {
  try {
    const { project_name, description, manager_id, end_date, status, team_id, deadline, project_id } = req.body;

    // If project_id is being updated, ensure it's unique
    if (project_id) {
      const existingProject = await Project.findOne({ 
        project_id: project_id,
        _id: { $ne: req.params.id } // Exclude current project from check
      });
      
      if (existingProject) {
        return res.status(400).json({ message: "Project ID already exists" });
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      {
        project_name,
        project_id, // Update project_id if provided
        description,
        manager: manager_id,
        end_date,
        status,
        team: team_id || null,
        deadline, // Update deadline if provided
      },
      { new: true }
    )
      .populate("manager", "name email role")
      .populate("team", "team_name");

    if (!updatedProject) return res.status(404).json({ message: "Project not found" });

    res.status(200).json({ message: "Project updated successfully", project: updatedProject });
  } catch (err) {
    console.error("Update Project Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete Project
 */
export const deleteProject = async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    if (!deletedProject) return res.status(404).json({ message: "Project not found" });

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Delete Project Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};













// // backend/controllers/projectController.js
// import Project from "../models/Project.js";
// import Team from "../models/Team.js";
// import User from "../models/User.js";

// /**
//  * Create Project
//  */
// export const createProject = async (req, res) => {
//   try {
//     const { project_name, description, manager_id, end_date, status, team_id } = req.body;

//     if (!project_name || !manager_id) {
//       return res.status(400).json({ message: "Project name and manager are required" });
//     }

//     const project = await Project.create({
//       project_name,
//       description: description || "",
//       manager: manager_id,
//       team: team_id || null,
//       status: status || "In Progress",
//       end_date: end_date || null,
//     });

//     await project.populate("manager", "name email role");
//     await project.populate("team", "team_name");

//     res.status(201).json({ message: "Project created successfully", project });
//   } catch (err) {
//     console.error("Create Project Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * Get Projects (with filters & summary)
//  * Query params supported:
//  * - search (name / manager name)
//  * - status
//  * - manager (manager id)
//  * - team (team id)
//  * - from (ISO date)
//  * - to (ISO date)
//  * - page (number)
//  * - limit (number)
//  */
// export const getProjects = async (req, res) => {
//   try {
//     const {
//       search,
//       status,
//       manager,
//       team,
//       from, // start date lower bound (projects with deadline >= from)
//       to, // end date upper bound (projects with deadline <= to)
//       page = 1,
//       limit = 12,
//       sortBy = "createdAt",
//       sortDir = "desc",
//     } = req.query;

//     const userRole = req.user.role?.toLowerCase();
//     const userId = req.user._id;

//     const q = {};

//     // Role-based filtering: Only show projects of teams the user belongs to
//     if (userRole !== "admin") {
//       // Find teams where user is team_leader OR a member
//       const userTeams = await Team.find({
//         $or: [
//           { team_leader: userId },
//           { "members.employee": userId }
//         ]
//       }).select("_id");

//       const userTeamIds = userTeams.map(t => t._id);

//       // If team filter is provided, verify user has access to that team
//       if (team) {
//         if (!userTeamIds.some(id => id.toString() === team.toString())) {
//           // User doesn't have access to this team - return empty results
//           return res.status(200).json({ projects: [], summary: { total: 0, completed: 0, inProgress: 0, onHold: 0 } });
//         }
//         // User has access, filter by this specific team
//         q.team = team;
//       } else {
//         // No team filter: show projects of all user's teams
//         // Also include projects where user is the manager (for managers)
//         if (userRole === "manager") {
//           q.$or = [
//             { team: { $in: userTeamIds } },
//             { manager: userId }
//           ];
//         } else {
//           // For employees/HR: only projects of their teams
//           q.team = { $in: userTeamIds };
//         }
//       }
//     } else {
//       // Admin: can filter by any team
//       if (team) q.team = team;
//     }

//     // Apply additional filters
//     if (status) q.status = status;
//     if (manager) q.manager = manager;

//     // date range on end_date
//     if (from || to) {
//       q.end_date = {};
//       if (from) q.end_date.$gte = new Date(from);
//       if (to) q.end_date.$lte = new Date(to);
//     }

//     // text search in project_name or manager name (manager search will need a join)
//     // We'll search project_name first and then filter by populated manager name.
//     if (search) {
//       q.project_name = { $regex: search, $options: "i" };
//     }

//     const skip = (Math.max(parseInt(page, 10), 1) - 1) * Math.max(parseInt(limit, 10), 1);
//     const sort = { [sortBy]: sortDir === "asc" ? 1 : -1 };

//     // Fetch projects with population
//     let projects = await Project.find(q)
//       .populate("manager", "name email role")
//       .populate("team", "team_name")
//       .sort(sort)
//       .skip(skip)
//       .limit(parseInt(limit, 10));

//     // If search matches manager name but project_name didn't match, also include those
//     if (search) {
//       // find managers whose name matches
//       const managers = await User.find({ name: { $regex: search, $options: "i" } }).select("_id");
//       const managerIds = managers.map((m) => m._id.toString());
//       if (managerIds.length > 0) {
//         // Apply same role-based filtering for search results
//         const searchQuery = { ...q, manager: { $in: managerIds } };
//         const extra = await Project.find(searchQuery)
//           .populate("manager", "name email role")
//           .populate("team", "team_name")
//           .sort(sort)
//           .skip(skip)
//           .limit(parseInt(limit, 10));
//         // merge unique by id
//         const map = new Map(projects.map((p) => [p._id.toString(), p]));
//         extra.forEach((p) => {
//           if (!map.has(p._id.toString())) map.set(p._id.toString(), p);
//         });
//         projects = Array.from(map.values());
//       }
//     }

//     // Build summary counts across all matching projects (ignores pagination)
//     const allMatching = await Project.find(q)
//       .populate("manager", "name")
//       .populate("team", "team_name");

//     const total = allMatching.length;
//     const completed = allMatching.filter((p) => p.status === "Completed").length;
//     const inProgress = allMatching.filter((p) => p.status === "In Progress").length;
//     const onHold = allMatching.filter((p) => p.status === "On Hold").length;

//     const summary = {
//       total,
//       completed,
//       inProgress,
//       onHold,
//     };

//     res.status(200).json({ projects, summary });
//   } catch (err) {
//     console.error("Get Projects Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * Get project by id
//  */
// export const getProjectById = async (req, res) => {

//   try {
//     const project = await Project.findById(req.params.id)
//       .populate("manager", "name email role")
//       .populate("team", "team_name");

//     if (!project) return res.status(404).json({ message: "Project not found" });
//     res.status(200).json(project);
//   } catch (err) {
//     console.error("Get Project Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * Update Project
//  */
// export const updateProject = async (req, res) => {
//   try {
//     const { project_name, description, manager_id, end_date, status, team_id } = req.body;

//     const updatedProject = await Project.findByIdAndUpdate(
//       req.params.id,
//       {
//         project_name,
//         description,
//         manager: manager_id,
//         end_date,
//         status,
//         team: team_id || null,
//       },
//       { new: true }
//     )
//       .populate("manager", "name email role")
//       .populate("team", "team_name");

//     if (!updatedProject) return res.status(404).json({ message: "Project not found" });

//     res.status(200).json({ message: "Project updated successfully", project: updatedProject });
//   } catch (err) {
//     console.error("Update Project Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * Delete Project
//  */
// export const deleteProject = async (req, res) => {
//   try {
//     const deletedProject = await Project.findByIdAndDelete(req.params.id);
//     if (!deletedProject) return res.status(404).json({ message: "Project not found" });

//     res.status(200).json({ message: "Project deleted successfully" });
//   } catch (err) {
//     console.error("Delete Project Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };


















// // import Project from "../models/Project.js";

// // // ---------------- Create Project ----------------
// // export const createProject = async (req, res) => {
// //   try {
// //     const { project_name, description, manager_id, deadline, status } = req.body;

// //     if (!project_name || !manager_id) {
// //       return res.status(400).json({ message: "Project name and manager are required" });
// //     }

// //     const project = await Project.create({
// //       project_name,
// //       description: description || "",
// //       manager: manager_id,
// //       status: status || "In Progress",
// //       deadline: deadline || null,
// //     });

// //     // Populate manager info before sending response
// //     await project.populate("manager", "name email role");

// //     res.status(201).json({ message: "Project created successfully", project });
// //   } catch (err) {
// //     console.error("Create Project Error:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // };

// // // ---------------- Get All Projects ----------------
// // export const getProjects = async (req, res) => {
// //   try {
// //     const projects = await Project.find().populate("manager", "name email role");
// //     res.status(200).json({ data: projects });
// //   } catch (err) {
// //     console.error("Get Projects Error:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // };

// // // ---------------- Get Project By ID ----------------
// // export const getProjectById = async (req, res) => {
// //   try {
// //     const project = await Project.findById(req.params.id).populate(
// //       "manager",
// //       "name email role"
// //     );
// //     if (!project) return res.status(404).json({ message: "Project not found" });

// //     res.status(200).json(project);
// //   } catch (err) {
// //     console.error("Get Project Error:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // };

// // // ---------------- Update Project ----------------
// // export const updateProject = async (req, res) => {
// //   try {
// //     const { project_name, description, manager_id, deadline, status } = req.body;

// //     const updatedProject = await Project.findByIdAndUpdate(
// //       req.params.id,
// //       {
// //         project_name,
// //         description,
// //         manager: manager_id,
// //         deadline,
// //         status,
// //       },
// //       { new: true }
// //     ).populate("manager", "name email role");

// //     if (!updatedProject)
// //       return res.status(404).json({ message: "Project not found" });

// //     res.status(200).json({ message: "Project updated successfully", project: updatedProject });
// //   } catch (err) {
// //     console.error("Update Project Error:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // };

// // // ---------------- Delete Project ----------------
// // export const deleteProject = async (req, res) => {
// //   try {
// //     const deletedProject = await Project.findByIdAndDelete(req.params.id);
// //     if (!deletedProject)
// //       return res.status(404).json({ message: "Project not found" });

// //     res.status(200).json({ message: "Project deleted successfully" });
// //   } catch (err) {
// //     console.error("Delete Project Error:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // };
