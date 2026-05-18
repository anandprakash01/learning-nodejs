import cluster from "cluster";
import os from "os";
import http from "http";

import {setupMaster, setupWorker} from "@socket.io/sticky";
import {setupPrimary} from "@socket.io/cluster-adapter";

import app from "./src/app.js";
import {initializeSockets} from "./src/sockets/io.js";

// Ask the motherboard for the exact number of physical processing threads
const numCPUs = os.cpus().length;

/* ======================================================
   🚨 BLOCK 1: THE PRIMARY TRAFFIC COP
====================================================== */

if (cluster.isPrimary) {
  console.log(`[PRIMARY] Process (PID: ${process.pid}) is booting...`);
  console.log(`[PRIMARY] Detecting ${numCPUs} CPU cores. Forking workers...`);

  // 1. Create a completely empty HTTP server.
  // It has NO express logic. Its only job is to catch raw network packets.
  const httpServer = http.createServer();

  // 2. Initialize the Sticky IP Router on the Primary.
  // When a packet arrives, it hashes the user's IP and forwards it to the correct Worker.
  setupMaster(httpServer, {loadBalancingMethod: "least-connection"});

  // 3. Initialize the IPC Pub/Sub Bridge Coordinator.
  // This allows the Primary to act as the central switchboard for cross-worker Socket messages.
  setupPrimary();

  // 4. Command the V8 engine to clone itself across the CPU cores
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // 5. Worker lifecycle management (Resurrection)
  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `[CRASH] Worker ${worker.process.pid} exited with code ${code}. Booting replacement...`,
    );
    cluster.fork(); // Instant resurrection
  });

  // 6. The Traffic Cop physically binds to Port 3000
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 [PRIMARY] Cluster listening on port ${PORT}`);
  });
} else {
  /* ======================================================
   🚨 BLOCK 2: THE WORKER ENGINE
====================================================== */
  // 1. Wrap Express app in a raw Node HTTP server so Sockets can attach
  const httpServer = http.createServer(app);

  // 2. 2. Initialize Socket.IO and capture the returned Server instance on this specific clone
  const io = initializeSockets(httpServer);

  // 3. Tell the Sticky Worker module to listen for packets handed down by the Primary Cop.
  // Pass the 'io' instance to setupWorker, not the raw HTTP server
  // NOTICE: We do NOT call httpServer.listen(3000). The Primary already owns Port 3000!
  setupWorker(io);

  console.log(
    `[WORKER] Engine running on PID: ${process.pid} and WorkerId:: ${cluster.worker.id}`,
  );
}

// By removing the Sticky routing and handling it this way:

// httpServer.listen(PORT, () => {
//     console.log(`🚀 [PRIMARY] Cluster listening on port ${PORT}`);
// });

// listen inside the worker

// 1. Express APIs get way faster: HTTP requests no longer have to be intercepted by the Master and proxied over IPC. The OS routes API requests directly to the fastest available Worker.

// 2. Less overhead: Your Primary process is now incredibly lightweight. Its only job is to resurrect dead workers and pass the internal Socket.io "walkie-talkie" messages.

// if the Primary process doesn't even have an io variable, and doesn't load the Server from "socket.io", how on earth does it handle those walkie-talkie messages?

// The secret lies in a hidden feature of Node.js called IPC (Inter-Process Communication), and how the @socket.io/cluster-adapter hijacks it.

// The Hidden Wires: IPC Channels
// When the Primary process runs cluster.fork() to create a Worker, Node.js does something special behind the scenes. It automatically strings a hidden, two-way communication cable between the Primary and that specific Worker. This is the IPC Channel.

// If you have 4 CPU cores, the Primary is holding 4 separate cables, one connected to each Worker.

// 1. What happens in the Primary (setupPrimary())
// When you call setupPrimary() in your Manager block, it does not boot up Socket.io.

// Instead, it injects a tiny script into the Primary process that says:
// "Listen to all 4 of these IPC cables. If you hear a message come up from Cable 1, immediately copy it and push it down Cables 2, 3, and 4. You don't need to read the message, just pass it along!"

// The Primary acts as a completely blind, incredibly fast relay tower.

// 2. What happens in the Worker (createAdapter())
// When you put io.adapter(createAdapter()) inside your Worker block, you are physically modifying how Socket.io's internal emit function works.

// You are telling Socket.io:
// "When I call io.emit('chat_message'), send it to my connected users first. BUT THEN, bundle that data up and shoot it UP the hidden IPC cable to the Primary."

// The Full Journey of a Single Message
// Let's trace exactly what happens when a user types "Hello World" in your chat app.

// The Origin: User A (connected to Worker 1) sends "Hello World".

// The Worker's Job: Worker 1 receives the HTTP packet, parses it, and runs io.emit("new_message", "Hello World").

// The Interception: Worker 1 sends the message to all the users currently connected to itself. Then, the cluster-adapter grabs a copy of "Hello World" and fires it UP the IPC cable to the Primary.
// The Switchboard: The Primary Process receives the packet. Because you ran setupPrimary(), it instantly says, "Incoming message from Worker 1! Forwarding to Workers 2, 3, and 4!"

// The Arrival: Workers 2, 3, and 4 receive the packet coming DOWN their IPC cables. Their adapters catch it, unpack it, and trigger a local emit on their ends.

// The Destination: Users connected to Workers 2, 3, and 4 instantly receive "Hello World" on their screens.

// The Technical Reality: cluster.fork() is Asynchronous
// When you call cluster.fork(), it does not block the thread. Node.js does not stop and wait for Worker 1 to fully boot before moving on to fork Worker 2.

// It just throws the request at the Operating System and immediately loops to the next iteration. Your 4 Workers are literally racing each other to initialize. Whichever one finishes the race first, logs first!
