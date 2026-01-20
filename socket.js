import { Server } from "socket.io";

const onlineUsers = new Map();

export const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    socket.on("join", (userId) => {
      if (!userId) return;
      const uid = userId.toString();

      socket.join(uid);
      onlineUsers.set(uid, socket.id);

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });

    // ✅ Chat Events
    socket.on("chat:sendMessage", (payload) => {
      if (!payload?.receiverId) return;
      io.to(payload.receiverId.toString()).emit("chat:receiveMessage", payload);
    });

    socket.on("chat:typing", ({ receiverId, senderId }) => {
      if (!receiverId) return;
      io.to(receiverId.toString()).emit("chat:typing", { senderId });
    });

    socket.on("chat:stopTyping", ({ receiverId, senderId }) => {
      if (!receiverId) return;
      io.to(receiverId.toString()).emit("chat:stopTyping", { senderId });
    });

    // ✅ Notifications Example
    socket.on("notification:markSeen", ({ userId }) => {
      if (!userId) return;
      io.to(userId.toString()).emit("notification:refresh", {
        message: "Refresh notifications",
      });
    });

    socket.on("disconnect", () => {
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
