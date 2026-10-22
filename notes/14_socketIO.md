# Sockets (TCP connections)

## 1. WebSockets (The Raw TCP Protocol)

WebSocket is a standardized network protocol (like HTTP or FTP) that provides full-duplex, continuous, bi-directional communication channels over a single TCP connection.

### How it Works (The Physics)

To understand WebSockets, you must understand why HTTP fails at real-time communication.

- **The HTTP Walkie-Talkie:** HTTP is inherently "stateless" and "half-duplex."
  - The client (React) presses the button and says: "Give me data".
  - The server responds: "Here is data." Then they immediately hang up.
  - If the server gets a new chat message 2 seconds later, it physically cannot tell React, because the connection is dead. React has to ask again.

- **The WebSocket Phone Call:** A WebSocket connection starts its life as a normal HTTP request. But React includes a special header: `Connection: Upgrade`, `Upgrade: websocket`.

- **The Upgrade:** If the Node.js server agrees, it replies with an HTTP `101 Switching Protocols` status. At this exact millisecond, the HTTP protocol is completely stripped away. The underlying raw TCP socket is kept open. Now, both the server and the client can push data to each other at the exact same time (full-duplex) with virtually zero latency.

---

## The Architectural Nightmare (The Clash)

Here is where Junior Developers destroy their production servers: **Clustering breaks WebSockets.**

Imagine this physical sequence:

1. React sends an HTTP request to establish a WebSocket tunnel.
2. The Primary Traffic Cop intercepts it and hands it to Worker 1.
3. Worker 1 completes the HTTP handshake and says, "Okay, switch to TCP!"
4. React sends the follow-up TCP upgrade packet.
5. But the Primary Traffic Cop decides Worker 1 is busy, so it hands the second packet to Worker 2.
6. Worker 2 looks at the packet, has no idea who this React client is (because the memory is in Worker 1), and violently terminates the connection.

To fix this, we must configure the Primary to use **Sticky Sessions** (forcing the same IP address to always hit the same Worker) or use a **Redis Adapter** to link the RAM of all the Workers together.

We must install two highly specific Enterprise adapters:

- **Sticky Sessions:** A script that forces the Primary to remember the user's IP Address, ensuring their packets always hit the exact same Worker.
- **Cluster Adapter:** A script that connects the isolated RAM of all 8 Workers together, so if Worker 1 broadcasts a message, users connected to Worker 4 still hear it.

---

## 2. Socket.IO (The Enterprise Abstraction)

Socket.IO is a JavaScript library that enables low-latency, bidirectional, and event-based communication between a client and a server.

### The Misconception

Socket.IO is NOT a WebSocket. Socket.IO is a framework that uses WebSockets under the hood, but it adds an Enterprise armor around it.

### How it Works & Why We Need It

If raw WebSockets are so fast, why do we install the `socket.io` library? Because raw WebSockets are incredibly fragile.

- **The Fallback Engine:** Some corporate firewalls and strict antivirus software physically block WebSocket connections. If you use raw WebSockets, your app just crashes for that user.
  Socket.IO detects the block and automatically downgrades the connection to "HTTP Long-Polling" (simulating real-time over standard HTTP) so your app still works.
- **Auto-Reconnection:** Mobile phones lose signal constantly. A raw WebSocket drops and stays dead. Socket.IO has a built-in heartbeat algorithm (Ping/Pong). If it detects a dropped connection, it automatically tries to reconnect in the background with exponential backoff.
- **Rooms and Namespaces:** Socket.IO allows you to group TCP connections into "Rooms". If you want to send a message to 50 users in the "General Chat" room, you just write `io.to('General Chat').emit()`. Without Socket.IO, you would have to write a custom loop iterating over 50 individual TCP connections.

### `new Server(httpServer, [options])`

Initializes the WebSocket server instance.
It attaches an upgrade handler to the provided Node.js HTTP server. When an HTTP request with the `Upgrade: websocket` header arrives, this class handles the cryptographic handshake required to transition the protocol to TCP.

**Key Configurations (`options`):**

- `cors`: Defines origin, methods, and credentials policies.
- `pingTimeout` (Default: 20000ms): How long the server waits for a heartbeat before forcefully terminating a dead TCP connection.
- `pingInterval` (Default: 25000ms): How frequently the server sends a heartbeat request.
- `transports`: Array restricting the protocol. Default is `['polling', 'websocket']`. You can force `['websocket']` to strictly disable HTTP long-polling fallbacks.
- **Returns:** The `Server` instance (commonly named `io`). This is the root control plane for all real-time connections.

### `io.on('connection', (socket) => {})`

**What the `socket` object is:** This is the foundational unit of Socket.IO. It is NOT the raw TCP socket provided by the OS. It is a highly abstracted Node.js class (`Socket`) that wraps the underlying TCP stream, providing buffering, acknowledgement callbacks, and room management.

**How it is passed:** It is automatically instantiated and injected into the callback by the Server class the millisecond a client successfully completes the connection handshake.

**Key Properties of `socket`:**

- `socket.id`: A 20-character cryptographically random string unique to this connection.
- `socket.handshake`: An object containing the initial HTTP headers, query parameters, and auth tokens provided during the connection request.
- `socket.rooms`: A JavaScript `Set` containing the names of all abstract channels this socket has joined.

---

### The Difference Between `io` and `socket` (Cheat Sheet)

This is the most common point of confusion. `io` is the entire server manager. `socket` is the individual user's connection.

| Method                       | What it does       | Who receives the event?                                        |
| :--------------------------- | :----------------- | :------------------------------------------------------------- |
| `io.emit("event", data)`     | Global Broadcast   | Every single client connected to the server.                   |
| `io.to("room1").emit(...)`   | Targeted Broadcast | Only the clients who have joined "room1".                      |
| `socket.emit("event", data)` | Direct Message     | Only the specific client who owns this socket.                 |
| `socket.broadcast.emit(...)` | Excluded Broadcast | Everyone on the server except the client who owns this socket. |
| `socket.join("room1")`       | Grouping           | Subscribes this specific client to "room1".                    |

**Summary Quick Reference:**

- **`socket`**: One single user (The person who triggered the event). _Example:_ `socket.emit('receipt', data)` sends data ONLY to that specific user.
- **`io`**: The entire network of connected users. _Example:_ `io.emit('news', data)` sends data to EVERYONE on the server.
- **`io.to()`**: A specific group of users. _Example:_ `io.to('adminRoom').emit(...)` sends data to everyone INSIDE that specific room.

---

## The Process Summary

1. We use **Cluster** to clone our V8 engine across all CPU cores so we can handle 100,000 users instead of 10,000.
2. We use **WebSockets** to keep the network pipes open so data flows instantly.
3. We use **Socket.IO** to ensure those pipes don't break, and to manage our Chat Rooms effortlessly.

**Process Flow:**

- The Express App (The basic HTTP worker)
- The Socket Engine (The TCP tunnel)
- The Server Bootstrapper (The Multi-Core Traffic Cop)

## 3. Socket.IO: Cluster Adapters & Sticky Sessions

```bash
npm install socket.io @socket.io/cluster-adapter @socket.io/sticky
```

`@socket.io/cluster-adapter`, `@socket.io/sticky` are independent packages (specifically, they are plugins or adapters).
These two packages are just small, highly specialized tools built by the official Socket.io team to solve two massive problems that happen when you try to run Socket.io on multiple CPU cores.

---

## 1. `@socket.io/sticky` (The Routing Problem)

When you run 8 instances of your app on 8 CPU cores, the Operating System acts as a traffic cop (a Load Balancer). If a user connects, the OS sends them to Core 1. If they send another request, the OS might send them to Core 4 to keep things balanced.

- **The Problem:**
  Socket.io uses `Long Polling` and `WebSockets` to establish a continuous connection. It requires a handshake. If a user starts their handshake on Core 1, but their next packet gets routed to Core 4, Core 4 says, "I don't know who you are, I never did a handshake with you!" and drops the connection. Your users will constantly disconnect.

- **The Solution (`@socket.io/sticky`):**
  This package creates "Sticky Sessions." It modifies the master traffic cop so that it remembers the IP address of the user. If User A connects to Core 3, this package guarantees that every single subsequent request from User A will be forcefully routed to Core 3.
  - **1. `setupMaster(httpServer, [options])`**
    Intercepts incoming network connections on the Primary process before they are routed.
    It pauses the incoming TCP socket connection. It reads the remote client's IP address, generates a hash, and uses that hash to assign the connection to a specific Worker PID. It then sends the raw TCP socket down the IPC bus to that exact Worker.
    - **Configurations:** `loadBalancingMethod`: Can be `'round-robin'` (default), `'least-connection'` (routes to the worker with the fewest active sockets), or `'random'`.

  - **2. `setupWorker(io)`**
    Receives the paused TCP sockets from the Primary process.
    It listens on the IPC bus. When the Primary hands it a raw TCP connection, it injects that connection directly into the Socket.IO engine, bypassing the normal HTTP handshake listener.
    - **Expected Argument:** It strictly requires the Server instance from Socket.IO (often mapped to the variable `io`).

---

## 2. `@socket.io/cluster-adapter` (The Communication Problem)

Because Workers have isolated RAM, a Socket connected to Worker A cannot natively broadcast to a Socket on Worker B.
Let's go back to the restaurant kitchen analogy. You have 8 Chefs (Cores) working in the same kitchen, but they are all wearing noise-canceling headphones. They cannot hear each other.

- **The Problem:**
  Imagine User A is connected to Core 1, and User B is connected to Core 2.
  User A sends a chat message, and Core 1 processes it. You write the code: `io.emit("new_message", data)`.
  Core 1 will send that message to everyone connected to Core 1. But User B is on Core 2! Core 1 has no idea Core 2 even exists, so User B never gets the message.

- **The Solution (`@socket.io/cluster-adapter`):**
  This package builds a walkie-talkie system between your CPU Cores using Node.js's native Inter-Process Communication (IPC).
  When Core 1 says `io.emit()`, the Cluster Adapter intercepts it, broadcasts the message over the walkie-talkie to Cores 2 through 8, and says, "Hey everyone, send this message to your connected users too!"
  - **1. `setupPrimary()`**
    Initializes a central Pub/Sub (Publish/Subscribe) broker inside the Primary process.
    It listens to the IPC bus for broadcast events from any worker, and immediately duplicates and propagates those events to all other workers.

  - **2. `createAdapter()`**
    Replaces Socket.IO's default in-memory adapter.
    When a worker calls `io.emit()`, instead of just looping through its own local memory array of connected sockets, this adapter serializes the message and pushes it up the IPC bus to the Primary broker.
    - **Returns:** An Adapter constructor function that Socket.IO consumes via `io.adapter()`.

---

## Step 1: Upgrading the Bootstrapper (📄 `server.js`)

```javascript
import cluster from "cluster";
import os from "os";
import {createServer} from "http";
import {setupMaster, setupWorker} from "@socket.io/cluster-adapter";
import app from "./src/app.js";
import {initializeSockets} from "./config/io.js";

// Count the physical CPU cores on the machine
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  // ==========================================================
  //   🚨 THE PRIMARY PROCESS (Traffic Cop)
  // ==========================================================
  console.log(`Primary Process ${process.pid} is running`);

  // This tells the Primary to keep track of WebSocket connections across workers
  setupMaster();

  // Fork a clone of the V8 engine for every CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // If a worker crashes (e.g., out of memory), instantly boot a new one!
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Booting a replacement...`);
    cluster.fork();
  });
} else {
  // ==========================================================
  //   🚨 THE WORKER PROCESS (The Express Engine)
  // ==========================================================
  // 1. We must wrap the Express app in a raw Node HTTP server so WebSockets can attach to it
  const httpServer = createServer(app);

  // 2. Attach WebSockets to the raw HTTP server
  initializeSockets(httpServer);

  // 3. Connect to MongoDB (Each worker gets its own DB connection pool)
  // connectDB();

  const PORT = process.env.PORT || 3000;

  httpServer.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on port ${PORT}`);
  });
}
```

---

## Step 2: Isolating the WebSocket Brain (📄 `config/io.js`)

```javascript
import {Server} from "socket.io";
import {createAdapter} from "@socket.io/cluster-adapter";
import {setupWorker} from "@socket.io/cluster-adapter";

export const initializeSockets = httpServer => {
  // 1. Initialize the WebSocket Server on top of HTTP
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? "[https://your-react-app.com](https://your-react-app.com)"
          : "http://localhost:5173",
      credentials: true,
    },
  });

  // 2. 🚨 THE ENTERPRISE SHIELD: Link this Worker's Socket RAM to the Primary Traffic Cop
  io.adapter(createAdapter());
  setupWorker(io);

  // 3. The TCP Connection Event
  io.on("connection", socket => {
    console.log(
      `New client connected to Worker ${process.pid} - Socket ID: ${socket.id}`,
    );

    // Listen for custom events from React
    socket.on("join_room", roomId => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("send_message", data => {
      // Broadcast the message to everyone else in that room
      socket.to(data.roomId).emit("receive_message", data);
    });

    // Handle Disconnection
    socket.on("disconnect", () => {
      console.log(
        `Client disconnected from Worker ${process.pid} - Socket ID: ${socket.id}`,
      );
    });
  });

  return io;
};
```

If you run `node server.js` now, your terminal will light up. You will see 1 Primary process boot, followed by 4 (or 8, or 12) Worker processes booting up simultaneously.

You just multiplied your server's processing power by the exact number of physical CPU cores on your machine.

You built an auto-healing system (if a Controller triggers a fatal bug and crashes a Worker, the Primary immediately spawns a new one without dropping the server offline).

You opened a persistent WebSocket tunnel that spans seamlessly across all CPU cores using the Cluster Adapter.

---

## The "Why": Bypassing the Middleman

When you were using `Socket.io` and `@socket.io/sticky`, the Primary process had to act as a middleman. It had to catch the request on Port 3000, read the IP address, and manually hand-deliver the request to a Worker.

When you drop Socket.io and build a pure API, you don't need a middleman anymore.

If the Primary process runs `.listen(PORT)` in an API setup, it catches all the traffic but has no code to actually process the Express routes, so the requests just sit there and die.

By moving `.listen(PORT)` directly into the Worker, Node.js performs a very cool magic trick:

All 4 Workers yell, "I want to listen on Port 3000!"

Normally, this would crash your app (Port Already In Use). But Node's `cluster` module intercepts this request.

Node tells the Operating System: "Hey, treat these 4 Workers as a single team. Automatically round-robin the incoming traffic directly to them."

The Primary process stays completely out of the way, making your API blindingly fast.

## 4. The Modern Cloud Standard: Why the Industry Drops Clusters

While the Node.js `cluster` module and Sticky Sessions are brilliant for squeezing every ounce of power out of a **single physical machine** (Vertical Scaling), they are practically abandoned in modern enterprise environments like AWS, Kubernetes, or Docker.

### Why We Delete the Cluster Code

In a modern cloud environment, engineers do not manage CPU cores manually. Instead, they write a simple, **single-threaded** Node.js application and package it inside a **Docker Container**.

If you deploy to platforms like AWS ECS, Render, or Heroku, the platform acts as the "Primary Traffic Cop." It automatically spins up 5, 10, or 100 separate Docker containers across entirely different servers and load-balances the traffic for you. If you use the Node `cluster` module inside a Docker container, you are creating a traffic cop _inside_ a traffic cop, which leads to massive routing failures.

### The Redis Solution (Horizontal Scaling)

When you have 10 Docker containers running on 10 different servers, `@socket.io/cluster-adapter` completely fails. It only works for CPU cores on the _same physical motherboard_ using IPC. It cannot send messages across the internet to another server.

To solve this, enterprise applications use **Redis** (an incredibly fast, in-memory database) combined with the `@socket.io/redis-adapter`.
Instead of Cores talking to each other, Server A publishes a message to Redis. Redis acts as a global megaphone and instantly broadcasts that message to Server B, Server C, and Server Z.

### The Simple Single-Threaded Setup

For 95% of modern applications, you should bypass the cluster entirely. You don't need `@socket.io/sticky` or `@socket.io/cluster-adapter`. You just need a clean, linear server file that can be easily wrapped in a Docker container or deployed to a PaaS.

**`📄server.js` (The Industry Standard Clean Setup):**

```javascript
import http from "http";
import {Server} from "socket.io";
import app from "./src/app.js";

// 1. Create the HTTP Server
const httpServer = http.createServer(app);

// 2. Initialize Socket.IO directly (No Adapters, No Clusters)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

// 3. Handle Connections
io.on("connection", socket => {
  console.log(`User connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// 4. Start the Server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});
```
