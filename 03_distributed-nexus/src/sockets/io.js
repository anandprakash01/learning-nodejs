import {Server} from "socket.io";
import {createAdapter} from "@socket.io/cluster-adapter";
import cluster from "cluster";

export const initializeSockets = httpServer => {
  // 1. Mount Socket.IO onto the raw HTTP server
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // In production, lock this to your React domain
      methods: ["GET", "POST"],
    },
  });

  // 2. 🚨 THE ENTERPRISE BRIDGE: Attach the Cluster Adapter
  // This physically wires this Worker's Socket RAM into the Node.js IPC bus.
  // Now, if this worker says "emit", it flows through the bus to all other workers.
  io.adapter(createAdapter());

  // 3. The TCP Connection Event
  io.on("connection", socket => {
    console.log(
      `🟢 [TCP] Client ${socket.id} connected to Worker ${process.pid} with workerId:: ${cluster.worker.id}`,
    );

    // Listen for a custom ping from React
    socket.on("ping_server", data => {
      console.log(`Worker ${process.pid} received:`, data);

      // Reply strictly to the user who sent it
      socket.emit("pong_client", {
        message: "Hello from the backend!",
        handledBy: process.pid,
      });
    });

    socket.on("disconnect", () => {
      console.log(`🔴 [TCP] Client ${socket.id} disconnected from Worker ${process.pid}`);
    });
  });
  return io;
};
