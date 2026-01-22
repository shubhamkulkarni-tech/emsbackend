import { Server } from "socket.io";

/*
  onlineUsers:
  userId => {
    socketId,
    status: "online" | "away" | "busy"
  }
*/
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

    /* ======================================================
       JOIN USER ROOM
    ====================================================== */
    socket.on("join", (userId) => {
      if (!userId) return;

      const uid = userId.toString();

      socket.join(uid);

      onlineUsers.set(uid, {
        socketId: socket.id,
        status: "online",
      });

      console.log("✅ User joined:", uid);

      // broadcast status update
      io.emit("user:statusUpdate", {
        userId: uid,
        status: "online",
      });

      // broadcast online users list
      io.emit(
        "onlineUsers",
        Array.from(onlineUsers.entries()).map(([id, v]) => ({
          userId: id,
          status: v.status,
        }))
      );
    });

    /* ======================================================
       USER STATUS (ONLINE / AWAY / BUSY)
    ====================================================== */
    socket.on("user:online", ({ userId }) => updateStatus(io, userId, "online"));
    socket.on("user:away", ({ userId }) => updateStatus(io, userId, "away"));
    socket.on("user:busy", ({ userId }) => updateStatus(io, userId, "busy"));

    /* ======================================================
       TYPING INDICATOR (DM)
    ====================================================== */
    socket.on("chat:typing", ({ receiverId, senderId }) => {
      if (!receiverId || !senderId) return;
      io.to(receiverId.toString()).emit("chat:typing", { senderId });
    });

    socket.on("chat:stopTyping", ({ receiverId, senderId }) => {
      if (!receiverId || !senderId) return;
      io.to(receiverId.toString()).emit("chat:stopTyping", { senderId });
    });

    /* ======================================================
       READ RECEIPTS (SOCKET ONLY NOTIFY)
       DB update happens in controller
    ====================================================== */
    socket.on("chat:messageSeen", ({ conversationId, senderId }) => {
      if (!conversationId || !senderId) return;
      io.to(senderId.toString()).emit("chat:messageSeen", {
        conversationId,
      });
    });

    socket.on("chat:messageDelivered", ({ messageId, receiverId }) => {
      if (!messageId || !receiverId) return;
      io.to(receiverId.toString()).emit("chat:messageDelivered", {
        messageId,
      });
    });

    /* ======================================================
       DISCONNECT
    ====================================================== */
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);

      let disconnectedUserId = null;

      for (const [userId, data] of onlineUsers.entries()) {
        if (data.socketId === socket.id) {
          disconnectedUserId = userId;
          onlineUsers.delete(userId);
          break;
        }
      }

      if (disconnectedUserId) {
        io.emit("user:statusUpdate", {
          userId: disconnectedUserId,
          status: "offline",
        });

        io.emit(
          "onlineUsers",
          Array.from(onlineUsers.entries()).map(([id, v]) => ({
            userId: id,
            status: v.status,
          }))
        );
      }
    });
  });

  return io;
};

/* ======================================================
   HELPER: UPDATE STATUS
====================================================== */
function updateStatus(io, userId, status) {
  if (!userId) return;

  const uid = userId.toString();
  const existing = onlineUsers.get(uid);
  if (!existing) return;

  onlineUsers.set(uid, {
    ...existing,
    status,
  });

  io.emit("user:statusUpdate", { userId: uid, status });
}
