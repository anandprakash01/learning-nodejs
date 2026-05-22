/* ======================================
physical limitation: Node.js is strictly single-threaded.

If you rent a heavy server from AWS that has an 8-Core CPU and 32GB of RAM, and you type node server.js, Node.js will only use 1 Core. The other 7 Cores will sit completely idle, doing zero work.

we must break out of that single thread. We are going to command Node.js to clone itself across every CPU core, and we are going to open a Persistent TCP Tunnel (WebSocket) so the server can talk to the React frontend without the frontend having to ask first.
====================================== */

import http from "http";
// import {Server} from "socket.io"

import env from "./config/env.js";
import connectDB from "./config/db.js";
import app from "./src/app.js";

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

// The HTTPS Wall: app.listen() ONLY creates an insecure http server. If you deploy your app and need an SSL Certificate (to make your site https://), app.listen() becomes completely useless. You are physically forced to write https.createServer({ key: sslKey, cert: sslCert }, app). By writing the explicit server creation now, your architecture is already prepped for SSL.

// Automated Testing: if you use app.listen(), the server immediately binds to the port. If you want to use Supertest to run automated tests on your API, Supertest needs your app without the port being opened.

// ========== DB Connection ==========
// Network Traffic is the absolute last thing a server should accept. You must boot the database before you open the port. If you open Port first, a user might hit your API in the 200 milliseconds it takes Mongoose to connect, and their request will fail.

// connectDB().catch(error => {
//   console.error("Database connection failed:", error);
//   process.exit(1);
// });

// .catch() is a Promise chain, Node.js will execute connectDB(), realize it takes time, push it to the background, and immediately execute server.listen(3000). Your server will start accepting HTTP requests before the database finishes connecting. If a user hits your API in that split second, the app crashes.

const startServer = async () => {
  await connectDB();

  server.listen(env.PORT, () => {
    console.log(`[${env.NODE_ENV}] mode server started on port ${env.PORT}`);
  });
};

// Execute the Boot Sequence
startServer();

// asyncHandler and globalErrorHandler ONLY protect the routes (URLs) inside the Express application.
// What happens if the database connection dies outside of a route? What if a background worker thread crashes? What if you use a third-party library that has a bug and throws an error before Express even touches the request?

// --- Process Level Safety Nets ---
process.on("uncaughtException", err => {
  console.error("🚨 UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

process.on("unhandledRejection", err => {
  console.error("🚨 UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

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

// Variables in your RAM might be half-written or corrupted.

// The Node.js Event Loop can no longer be trusted to execute code predictably.

// Why no server.close()?
// server.close() is an asynchronous function. It tells the server, "Stop accepting new traffic, wait for all currently connected users to finish downloading their data, and then shut down."

// Because your entire application's memory is currently corrupted, attempting to keep the server alive to finish serving those active users is incredibly dangerous. It can trigger infinite loops, memory leaks, or cause your server to start sending corrupted data to users.

// When you hit an uncaughtException, you must pull the power plug immediately with a synchronous process.exit(1).

// 2. unhandledRejection (The Graceful Shutdown)
// An unhandledRejection happens when an asynchronous Promise fails, and you forgot to attach a .catch() block to it.

// Unlike a synchronous exception, a rejected Promise happens in the background. The main V8 thread and your application's core memory are still perfectly intact and healthy. The Node.js Event Loop is still spinning normally; it just has an orphaned error floating around.

// Why use server.close() here?
// Because the core engine is still healthy, we have the luxury of performing a Graceful Shutdown. We can safely use server.close() to say: "Hey, a database query failed in the background. Let's stop accepting new users, let the current 50 users finish their API requests safely, and then restart the process."

// 1. What is Round-Robin and How it Works
// Round-Robin is the default load-balancing algorithm used by Node.js and almost every major cloud provider (like AWS and Nginx). It is the simplest, most equitable way to distribute traffic.

// The Concept: Imagine a dealer handing out a deck of cards to 4 players. They deal one card to Player 1, the next to Player 2, then Player 3, then Player 4, and then they loop back to Player 1.

// How it works in your API: When 100 API requests hit your server at the exact same time, the Operating System acts as the dealer. It blindly routes Request #1 to Worker 1, Request #2 to Worker 2, Request #3 to Worker 3, Request #4 to Worker 4, and Request #5 back to Worker 1.
