/* ======================================
physical limitation: Node.js is strictly single-threaded.

If you rent a heavy server from AWS that has an 8-Core CPU and 32GB of RAM, and you type "node server.js", Node.js will only use 1 Core. The other 7 Cores will sit completely idle, doing zero work.

we must break out of that single thread. We are going to command Node.js to clone itself across every CPU core, and we are going to open a Persistent TCP Tunnel (WebSocket) so the server can talk to the React frontend without the frontend having to ask first.
====================================== */

// --- Process Level Safety Nets ---
// uncaughtException catches synchronous errors that occur anywhere in your application and are not wrapped inside a try...catch block.

// If an error happens synchronously and nothing in your code is explicitly written to catch it, the error bubbles all the way up to the Node.js environment itself. That is when this safety net triggers.
// eg. Reference Errors, Type Errors, Initialization Errors, Manual Throws

import http from "http";
// import {Server} from "socket.io"

import "./utils/crashHandler.js"; // this must be at top
import env from "./config/env.js";
import connectDB from "./config/db.js";
import app from "./app.js";

const server = http.createServer(app);

// http.createServer(app) instead of app.listen()?
// app.listen function is literally just a shortcut for this exact code:
// app.listen = function() {
//   var server = http.createServer(this); // 'this' is the Express app
//   return server.listen.apply(server, arguments);
// };

// why do we write it out the "long" way? Extensibility.
// you will eventually need to add WebSockets (Socket.io) for real-time chat, or you will need to add SSL certificates to run https instead of http.

// Socket.io cannot attach to an Express app. It is a different protocol.
// It must attach to the raw Node.js server object.

// const server = app.listen(port,()=>{
//   console.log(`Server is up and running at: ${port}`);
// })
// const io = new Server(server, {
//   pingTimeout: 60 * 1000, //60 sec
//   cors: {
//     origin: env.FRONTEND_URL,
//   },
// });

// The HTTPS Wall: app.listen() ONLY creates an insecure http server. If you deploy your app and need an SSL (Secure Sockets Layer) Certificate (to make your site https://), app.listen() becomes completely useless. You are physically forced to write https.createServer({ key: sslKey, cert: sslCert }, app). By writing the explicit server creation now, your architecture is already prepped for SSL.

// Automated Testing: if you use app.listen(), the server immediately binds to the port. If you want to use Supertest to run automated tests on your API, Supertest needs your app without the port being opened.

// ========== DB Connection ==========
// Network Traffic is the absolute last thing a server should accept. You must boot the database before you open the port. If you open Port first, a user might hit your API in the 200 milliseconds it takes Mongoose to connect, and their request will fail.

// connectDB().catch(error => {
//   console.error("Database connection failed:", error);
//   process.exit(1);
// });

// .catch() is a Promise chain, Node.js will execute connectDB(), realize it takes time, push it to the background, and immediately execute server.listen(3000). Your server will start accepting HTTP requests before the database finishes connecting. If a user hits your API in that split second, the app crashes.

// 1. Attach the error listener BEFORE trying to listen
server.on("error", error => {
  // If it's not a port-binding error
  if (error.syscall !== "listen") {
    console.error("[FATAL] [SERVER] Non-listen error occurred:", error);
    process.exit(1);
  }

  switch (error.code) {
    case "EADDRINUSE":
      console.error(`[FATAL] [SERVER] Port ${env.PORT} is already in use.`);
      break;
    case "EACCES":
      console.error(
        `[FATAL] [SERVER] Port ${env.PORT} requires elevated privileges (run as admin/root).`,
      );
      break;
    default:
      console.error("[FATAL] [SERVER] Unknown startup error:", error);
  }
  process.exit(1);
});

// syscall stands for "System Call". It is the underlying operation that Node.js requested from your operating system (Linux, Windows, macOS) when the error occurred.

// When you run server.listen(PORT), Node.js talks to the operating system using a C++ system call literally named "listen" (and "bind") to ask for control of that network port.

// Why we check it: The server.on("error") listener catches any error emitted by the HTTP server. By checking if (error.syscall !== "listen"), we are saying: "If this error did not happen during the OS port-binding phase, I don't know how to handle it here. Throw it so the uncaughtException handler can deal with it."

const startServer = async () => {
  await connectDB();

  server.listen(env.PORT, () => {
    console.log(
      `[INFO ] [SERVER] ${env.NODE_ENV} mode server started on port ${env.PORT}`,
    );
  });
};

// Execute the Boot Sequence
startServer();

// asyncHandler and globalErrorHandler ONLY protect the routes (URLs) inside the Express application.
// What happens if the database connection dies outside of a route? What if a background worker thread crashes? What if you use a third-party library that has a bug and throws an error before Express even touches the request?

// --- Process Level Safety Nets ---

process.on("unhandledRejection", err => {
  console.error("[FATAL] [PROCESS] UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message, err.stack);

  if (server.listening) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// 99% of the time unhandledRejection fires, your server will already be listening.
// However, keeping if (server.listening) is a good safety guard for the remaining 1%

const gracefulShutdown = signal => {
  console.log(`\n[${signal}] signal received. Stopping HTTP server...`);

  // 1. Stop accepting new requests
  server.close(async () => {
    console.log("HTTP server closed. All active requests finished.");

    try {
      // 2. Close database connections (Example using Mongoose)
      // await mongoose.connection.close();
      console.log("Database connections closed cleanly.");

      // 3. Exit process cleanly
      process.exit(0); // 0 indicates a successful, intended shutdown
    } catch (err) {
      console.error("Error during database disconnection:", err);
      process.exit(1);
    }
  });

  // Fallback: Force shutdown if connections hang for more than 10 seconds
  setTimeout(() => {
    console.error("[URGENT] Graceful shutdown timeout exceeded. Forcing exit.");
    process.exit(1);
  }, 10000).unref(); // unref() prevents the timeout from keeping the event loop alive
};

// SIGTERM is sent by Docker/Kubernetes/Heroku/PM2
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
// SIGINT is sent by Ctrl+C in the terminal
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Exit Status Code
// This is how Node.js talks to your Operating System right before it dies.
// process.exit(0) (Success)
// process.exit(1) (Uncaught Fatal Error)

// Why server.close() is critical:
// If your server has 500 users currently downloading data, and the process dies violently, all 500 users get a "Connection Severed" error on their screen.
// By writing server.close(() => process.exit(1)), you tell Node.js: "Stop accepting NEW traffic. Wait for the current 500 users to finish downloading. Then, shut down safely." This is called a Graceful Shutdown, and it is a mandatory Enterprise standard.

// if we want to safely shut down the server for a rejected promise, why wouldn't we do the exact same thing for a standard exception?

// The short answer is: No, you absolutely should not use server.close() inside uncaughtException.

// The reason comes down to how the V8 engine handles your computer's memory during these two different types of crashes.

// Here is exactly why they must be handled differently.

// 1. uncaughtException (The Hard Crash)
// An uncaughtException happens when a synchronous piece of code throws an error that isn't wrapped in a try/catch block.

// When this happens, the Node.js process enters what the official documentation calls an "unclean state."

// The V8 engine's internal call stack just exploded.
// Variables in your RAM might be half-written or corrupted, Memory might be leaking.
// The Node.js Event Loop can no longer be trusted to execute code predictably. continuing to run the application is a massive security and stability risk.

// Why no server.close()?
// server.close() is an asynchronous function. It tells the server, "Stop accepting new traffic, wait for all currently connected users to finish downloading their data, and then shut down."

// Because your entire application's memory is currently corrupted, attempting to keep the server alive to finish serving those active users is incredibly dangerous. It can trigger infinite loops, memory leaks, or cause your server to start sending corrupted data to users.

// When you hit an uncaughtException, you must pull the power plug immediately with a synchronous process.exit(1).

// 2. unhandledRejection (The Graceful Shutdown)
// An unhandledRejection happens when an asynchronous Promise fails, and you forgot to attach a .catch() block to it.

// Unlike a synchronous exception, a rejected Promise happens in the background. The main V8 thread and your application's core memory are still perfectly intact and healthy. The Node.js Event Loop is still spinning normally; it just has an orphaned error floating around.

// Why use server.close() here?
// Because the core engine is still healthy, we have the luxury of performing a Graceful Shutdown. We can safely use server.close() to say: "Hey, a database query failed in the background. Let's stop accepting new users, let the current 50 users finish their API requests safely, and then restart the process."

// SIGTERM and SIGINT
// When you deploy new code, scale down your servers, or restart a container, Docker/Kubernetes/PM2 does not just unplug the machine. They send a SIGTERM (terminate) signal. If your app ignores this, the host waits ~10 seconds and then forcefully executes a SIGKILL, which severs all active client downloads, aborts database writes, and causes data corruption.

// 1. What is Round-Robin and How it Works
// Round Robin is a load-balancing algorithm that distributes incoming network requests sequentially across a pool of servers or processes.
// Round-Robin is the default load-balancing algorithm used by Node.js and almost every major cloud provider (like AWS and Nginx). It is the simplest, most equitable way to distribute traffic.

// The Concept: Imagine a dealer handing out a deck of cards to 4 players. They deal one card to Player 1, the next to Player 2, then Player 3, then Player 4, and then they loop back to Player 1.

// Because Node.js runs on a single thread, a single instance can only utilize one CPU core. If your server has an 8-core CPU, 7 cores sit idle. Node.js creates exact duplicate processes of your app running simultaneously in the background. Each clone gets its own memory and its own CPU core. Round Robin is the internal "traffic cop" sitting in the primary server. Its only job is to catch the incoming request and decide which clone gets to process it..

// How it Works in Node.js
// Node.js implements Round Robin natively through the built-in cluster module.
// A Primary (Master) process is launched. It does not handle any application logic itself.
// The Primary spawns Worker processes (usually one for each CPU core).
// The Primary listens on your port (e.g., port 3000). When a request comes in, the Primary accepts it and hands it off to the next available Worker in a Round Robin sequence.

// How it works in your API: When 100 API requests hit your server at the exact same time, the Operating System acts as the dealer. It blindly routes Request #1 to Worker 1, Request #2 to Worker 2, Request #3 to Worker 3, Request #4 to Worker 4, and Request #5 back to Worker 1.

// In pure Round Robin, the algorithm is blind. It does not care if Worker 1 is still busy processing a heavy database query; if it is Worker 1's turn in the sequence, it gets the next request.

// What happens to that new request depends entirely on why the worker is busy:

// 1. The worker is busy with an I/O task (Database query, API call)
// Node.js handles this flawlessly. Because I/O tasks are non-blocking, the worker parks the heavy database query in the background and immediately starts processing the new request. Both requests progress concurrently on the same worker without issue.

// 2. The worker is busy with a CPU task (Complex math, massive JSON parse)
// This is where the Round Robin system breaks down. CPU-heavy tasks block the Node.js event loop. The new request sits completely frozen in the queue. Even if your other workers are sitting 100% idle, the request cannot jump over to them. The user simply experiences a long loading screen or a timeout error.

// How Developers Solve the CPU Trap
// If your app has heavy CPU tasks, relying on basic Round Robin clustering is dangerous. Developers fix this using two approaches:

// Smarter Load Balancing: Instead of Node's built-in Round Robin, they put a dedicated load balancer like Nginx in front of the app. Nginx can be configured to use the Least Connections algorithm, which actually checks how busy each worker is and routes traffic to the freest one.

// Worker Threads: Instead of letting the CPU task block the web server clone, developers use Node's worker_threads module. This offloads the heavy math to a completely separate background thread, keeping the web worker instantly available to accept the next Round Robin request.
