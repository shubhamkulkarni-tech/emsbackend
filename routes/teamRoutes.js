import express from "express";
import { createTeam, getTeams, updateTeam, deleteTeam, getTeamById } from "../controllers/teamController.js";
import protect, { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, authorizeRoles("admin"), createTeam);
router.get("/", protect, getTeams);
router.get("/:id", protect, getTeamById);
router.put("/:id", protect, authorizeRoles("admin"), updateTeam);
router.delete("/:id", protect, authorizeRoles("admin"), deleteTeam);

export default router;
