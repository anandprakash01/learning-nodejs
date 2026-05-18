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
