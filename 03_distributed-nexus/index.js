// When you were using Socket.io and @socket.io/sticky, the Primary process had to act as a middleman. It had to catch the request on Port 3000, read the IP address, and manually hand-deliver the request to a Worker.

// When you drop Socket.io and build a pure API, you don't need a middleman anymore.

// If the Primary process runs .listen(PORT) in an API setup, it catches all the traffic but has no code to actually process the Express routes, so the requests just sit there and die.

// By moving .listen(PORT) directly into the Worker, Node.js performs a very cool magic trick:

// All 4 Workers yell, "I want to listen on Port 3000!"

// Normally, this would crash your app (Port Already In Use). But Node's cluster module intercepts this request.

// Node tells the Operating System: "Hey, treat these 4 Workers as a single team. Automatically round-robin the incoming traffic directly to them."

// The Primary process stays completely out of the way, making your API blindingly fast.

import http from "http";
import os from "os";
import cluster from "cluster";

import app from "./src/app.js";
import env from "./config/env.js";
import connectDB from "./config/env.js";

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[PRIMARY] Process (PID: ${process.pid}) is booting...`);
  console.log(`[PRIMARY] Detecting ${numCPUs} CPU cores. Forking workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `🚨[CRASH] Worker ${worker.process.id} Exited with code ${code}, Booting replacement...`,
    );
    cluster.fork();
  });
} else {
  const server = http.createServer(app);
  const startServer = async () => {
    await connectDB();

    server.listen(env.PORT, () => {
      console.log(
        `✅ [WORKER ${cluster.worker.id}] (PID: ${process.pid}) listening on port ${env.PORT} in ${env.NODE_ENV} mode`,
      );
    });
  };

  startServer();

  process.on("uncaughtException", err => {
    console.error(
      `🚨 [WORKER ${cluster.worker.id}] UNCAUGHT EXCEPTION! Shutting down...`,
    );
    console.error(err.name, err.message);
    process.exit(1);
  });

  process.on("unhandledRejection", err => {
    console.error(
      `🚨 [WORKER ${cluster.worker.id}] UNHANDLED REJECTION! Shutting down...`,
    );
    console.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });
}
