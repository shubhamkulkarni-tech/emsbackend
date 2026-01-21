import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // ✅ dm = 1 to 1 chat
    // ✅ team = group chat (team group)
    type: {
      type: String,
      enum: ["dm", "team"],
      default: "dm",
    },

    // ✅ Only for team group chat
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    // ✅ Members list
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],

    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
