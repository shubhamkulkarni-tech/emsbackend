import { Server } from "socket.io";

const onlineUsers = new Map(); // userId => socketId

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

    // ✅ Join user room (VERY IMPORTANT)
    socket.on("join", (userId) => {
      try {
        if (!userId) return;

        const uid = userId.toString();

        socket.join(uid);
        onlineUsers.set(uid, socket.id);

        console.log("✅ User joined room:", uid);

        // ✅ Broadcast online users
        io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      } catch (err) {
        console.log("❌ join error:", err.message);
      }
    });

    /* ======================================================
       ✅ CHAT EVENTS (Realtime)
    ====================================================== */

    // ✅ Optional: typing
    socket.on("chat:typing", ({ receiverId, senderId }) => {
      if (!receiverId || !senderId) return;
      io.to(receiverId.toString()).emit("chat:typing", { senderId });
    });

    socket.on("chat:stopTyping", ({ receiverId, senderId }) => {
      if (!receiverId || !senderId) return;
      io.to(receiverId.toString()).emit("chat:stopTyping", { senderId });
    });

    // ✅ If you want client-to-client message event (optional)
    // NOTE: Your main DB save happens via controller route (/message/send)
    // so this is not required now.
    socket.on("chat:sendMessage", (payload) => {
      try {
        if (!payload?.receiverId) return;

        io.to(payload.receiverId.toString()).emit("chat:receiveMessage", payload);
      } catch (err) {
        console.log("❌ chat:sendMessage error:", err.message);
      }
    });

    /* ======================================================
       ✅ NOTIFICATION EVENTS (Optional)
    ====================================================== */
    socket.on("notification:markSeen", ({ userId }) => {
      if (!userId) return;
      io.to(userId.toString()).emit("notification:refresh", {
        message: "Refresh notifications",
      });
    });

    /* ======================================================
       ✅ DISCONNECT
    ====================================================== */
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);

      // remove from map
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
