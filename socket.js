import { Server } from "socket.io";

const onlineUsers = new Map(); // userId -> socketId

export const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // production me whitelist karna better
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    // ✅ JOIN USER ROOM (Common for both Chat + Notifications)
    socket.on("join", (userId) => {
      if (!userId) return;

      const uid = userId.toString();

      socket.join(uid);
      onlineUsers.set(uid, socket.id);

      console.log("🟢 User joined room:", uid);

      // ✅ broadcast online users list
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });

    // =========================================================
    // ✅ CHAT EVENTS
    // =========================================================

    // 🔥 Send message real-time
    // payload: { senderId, receiverId, conversationId, text, createdAt }
    socket.on("chat:sendMessage", (payload) => {
      try {
        if (!payload?.receiverId) return;

        const receiverId = payload.receiverId.toString();

        // send to receiver room
        io.to(receiverId).emit("chat:receiveMessage", payload);

        // optional ack
        socket.emit("chat:delivered", {
          conversationId: payload.conversationId,
          receiverId,
        });
      } catch (err) {
        console.log("❌ chat:sendMessage error:", err);
      }
    });

    // typing indicator
    socket.on("chat:typing", ({ receiverId, senderId }) => {
      if (!receiverId) return;
      io.to(receiverId.toString()).emit("chat:typing", { senderId });
    });

    socket.on("chat:stopTyping", ({ receiverId, senderId }) => {
      if (!receiverId) return;
      io.to(receiverId.toString()).emit("chat:stopTyping", { senderId });
    });

    // seen event
    socket.on("chat:seen", ({ receiverId, conversationId }) => {
      if (!receiverId) return;
      io.to(receiverId.toString()).emit("chat:seen", { conversationId });
    });

    // =========================================================
    // ✅ NOTIFICATION EVENTS
    // =========================================================

    // client can call this if needed
    socket.on("notification:markSeen", ({ userId }) => {
      if (!userId) return;
      io.to(userId.toString()).emit("notification:refresh", {
        message: "Refresh notifications",
      });
    });

    // =========================================================
    // ✅ DISCONNECT
    // =========================================================
    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);

      for (const [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};
