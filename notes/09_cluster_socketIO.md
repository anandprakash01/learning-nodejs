# Node.js Architecture: Clustering & WebSockets

- **IPC:** Inter-Process Communication
- **TCP:** Transmission Control Protocol
- **PID:** Process Identifier (or Process ID)

Node.js is strictly single-threaded.
A "thread" is a single, continuous sequence of instructions. It is a straight line of tasks that must be executed one after another.

If you rent a heavy server from AWS that has an 8-Core CPU and 32GB of RAM, and you type `node server.js`, Node.js will only use 1 Core. The other 7 Cores will sit completely idle, doing zero work.

---

## How Single-Threaded Works

To understand this physical limitation, we need to look at the relationship between Hardware (Cores) and Software (Threads).

The easiest way to understand this is through the **Restaurant Kitchen Analogy**.

Imagine you buy an expensive restaurant (the AWS Server) that comes with an incredible, massive kitchen.
The CPU Cores are your physical Chefs. An 8-Core CPU means you have 8 highly trained Chefs standing in the kitchen, ready to work.

A Thread is the Ticket Machine that prints out the orders for the Chefs to cook.

### What is a Thread, exactly?

In computer science, a "thread" is a single, continuous sequence of instructions. It is a straight line of tasks that must be executed one after another.

Here is the golden rule of computing: **One Chef (Core) can only read from one Ticket Machine (Thread) at a time.**
A single thread cannot be split in half. Two chefs cannot share the exact same ticket tape at the exact same time, because they would trip over each other trying to figure out who is chopping the onions and who is boiling the water.

### Why Node.js only uses 1 Core

By design, the Javascript Engine inside Node.js (the V8 engine) only generates one single thread for your code to run on. This is the famous "Event Loop."

So, when you type `node server.js` on that massive AWS server, here is what happens:

- Node.js boots up and creates exactly one Ticket Machine (Thread).
- The server's Operating System looks at your 8 Chefs (Cores) and says, "Okay, Chef #1, you are assigned to this Ticket Machine."
- Chef #1 starts furiously reading tickets and cooking (executing your JavaScript).
- Chefs #2 through #8 stand around with their arms crossed. Because there are no other Ticket Machines (Threads) for them to read from, they literally cannot help. They remain at 0% utilization.

No matter how fast Chef #1 works, if 10,000 users hit your website at the same time, that single Chef is going to get overwhelmed, and your server will slow down—even though 87% of your kitchen's cooking power is sitting completely idle!

### How do Node.js Developers fix this?

If Node.js is strictly single-threaded, how do massive companies like Netflix or Uber use it on huge AWS servers?

**They don't rewrite Node.js; they just clone the restaurant.**

Instead of just running `node server.js` once, developers use tools built into Node (like the `cluster` module) or process managers (like PM2) to run the app multiple times simultaneously.

If you have an 8-Core server, you tell PM2 to spin up 8 separate instances of your Node.js application.

---

We must break out of that single thread. We are going to command Node.js to clone itself across every CPU core, and we are going to open a Persistent TCP Tunnel (WebSocket) so the server can talk to the React frontend without the frontend having to ask first.

But before that, we must understand the architectural nightmare that happens when you combine Multi-Core Scaling with WebSockets.

## 1. The Node.js Cluster (The CPU Multiplier)

The `cluster` module is a built-in, native Node.js module that allows a single-threaded Node application to spawn multiple identical child processes (Workers) that simultaneously share the same server port.

When the server boots up, it looks at the physical hardware. If it sees 4 CPU cores, it creates 1 "Primary" process and forks 4 "Worker" processes.

### How it Works (The Physics):

- **The V8 Limitation:** The V8 JavaScript engine (which powers Node.js) is strictly single-threaded. It processes exactly one command at a time. If you run your app on an Amazon AWS server that has 16 CPU cores, Node.js will use 1 core, and 15 cores will sit doing absolutely nothing.
- **The Forking:** When you run `cluster.fork()`, Node.js talks to the OS. It says: "Allocate a brand new block of RAM, and spin up a completely independent clone of the V8 engine." If you do this 16 times, you now have 16 independent Node.js servers running simultaneously on your machine.
- **The Traffic Cop:** The Master process (Primary) doesn't run your application logic. It physically binds to Port 3000. When an HTTP request comes in from the internet, the Primary catches it, looks at the 16 Workers, finds the one doing the least amount of work (Round-Robin routing), and tosses the network request to that Worker to be processed.
- **The Workers:** These are 4 complete, isolated clones of your Express application.

**The Ramification:**
Worker 1 and Worker 2 do not share RAM. If you save a variable `let users = []` in Worker 1, Worker 2 has absolutely no idea that variable exists.

Because the cluster module has evolved over the years, there is a lot of information in that object.

**1. `cluster.isPrimary` (Boolean):**
A read-only boolean property. This is the exact same thing as `isMaster`. Years ago, Node.js used the terms "Master/Slave." The industry moved away from that terminology to "Primary/Worker." Node.js kept `isMaster` in the object so older apps wouldn't instantly crash.

**2. `cluster.isWorker` (Boolean):**
The exact opposite. If this is true, this process is a Chef. It should start Express and listen for Socket.io connections.

**3. `cluster.worker` (Singular):** This property only exists inside a Worker process. It is an object that contains the details of that specific worker. If Chef #3 logs this, they will see their own specific Worker ID (`cluster.worker.id`), their Process ID, and a method to disconnect themselves.

**4. `cluster.workers` (Plural):** This property usually lives on the Primary process. It is a giant dictionary object containing every single active worker. If the Manager needs to send a direct message to Chef #4, they would look them up in this dictionary.

**5. `cluster.fork([env])`:**
It physically creates a new V8 JavaScript instance in system RAM. It automatically sets up an IPC (Inter-Process Communication) channel between the Primary process and the new Worker process.

- **Configurations (`env`):** It accepts an optional object to pass custom environment variables to the specific worker. Example: `cluster.fork({ WORKER_ID: 1 })`.
- **Returns:** A `cluster.Worker` object, containing the worker's unique `id`, `process.pid`, and methods to send messages to it.

**6. `cluster.on(eventName, callback)`:**
The cluster module inherits from the native `EventEmitter` class. It listens for lifecycle events across the IPC bus.
Key Events:

- `'fork'`: Emitted when a new worker is spawned.
- `'online'`: Emitted when the worker successfully boots its V8 engine.
- `'exit'`: Emitted when a worker process terminates (either intentionally or via a fatal memory crash). The callback receives `(worker, code, signal)`.

**7. `cluster.disconnect()`:** Safely shuts down all workers.

---

## 2. WebSockets (The Raw TCP Protocol)

WebSocket is a standardized network protocol (like HTTP or FTP) that provides full-duplex, continuous, bi-directional communication channels over a single TCP connection.

### How it Works (The Physics):

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

## 3. Socket.IO (The Enterprise Abstraction)

Socket.IO is a JavaScript library that enables low-latency, bidirectional, and event-based communication between a client and a server.

### The Misconception:

Socket.IO is NOT a WebSocket. This is a massive point of confusion. Socket.IO is a framework that uses WebSockets under the hood, but it adds an Enterprise armor around it.

### How it Works & Why We Need It:

If raw WebSockets are so fast, why do we install the `socket.io` library? Because raw WebSockets are incredibly fragile.

- **The Fallback Engine:** Some corporate firewalls and strict antivirus software physically block WebSocket connections. If you use raw WebSockets, your app just crashes for that user.
  Socket.IO detects the block and automatically downgrades the connection to "HTTP Long-Polling" (simulating real-time over standard HTTP) so your app still works.
- **Auto-Reconnection:** Mobile phones lose signal constantly. A raw WebSocket drops and stays dead. Socket.IO has a built-in heartbeat algorithm (Ping/Pong). If it detects a dropped connection, it automatically tries to reconnect in the background with exponential backoff.
- **Rooms and Namespaces:** Socket.IO allows you to group TCP connections into "Rooms". If you want to send a message to 50 users in the "General Chat" room, you just write `io.to('General Chat').emit()`. Without Socket.IO, you would have to write a custom loop iterating over 50 individual TCP connections.

### `new Server(httpServer, [options])`:

Initializes the WebSocket server instance.
It attaches an upgrade handler to the provided Node.js HTTP server. When an HTTP request with the `Upgrade: websocket` header arrives, this class handles the cryptographic handshake required to transition the protocol to TCP.

**Key Configurations (`options`):**

- `cors`: Defines origin, methods, and credentials policies.
- `pingTimeout` (Default: 20000ms): How long the server waits for a heartbeat before forcefully terminating a dead TCP connection.
- `pingInterval` (Default: 25000ms): How frequently the server sends a heartbeat request.
- `transports`: Array restricting the protocol. Default is `['polling', 'websocket']`. You can force `['websocket']` to strictly disable HTTP long-polling fallbacks.
- **Returns:** The `Server` instance (commonly named `io`). This is the root control plane for all real-time connections.

### `io.on('connection', (socket) => {})`:

**What the `socket` object is:** This is the foundational unit of Socket.IO. It is NOT the raw TCP socket provided by the OS. It is a highly abstracted Node.js class (`Socket`) that wraps the underlying TCP stream, providing buffering, acknowledgement callbacks, and room management.

**How it is passed:** It is automatically instantiated and injected into the callback by the Server class the millisecond a client successfully completes the connection handshake.

**Key Properties of `socket`:**

- `socket.id`: A 20-character cryptographically random string unique to this connection.
- `socket.handshake`: An object containing the initial HTTP headers, query parameters, and auth tokens provided during the connection request.
- `socket.rooms`: A JavaScript `Set` containing the names of all abstract channels this socket has joined.

---

## The Process Summary

1. We use **Cluster** to clone our V8 engine across all CPU cores so we can handle 100,000 users instead of 10,000.
2. We use **WebSockets** to keep the network pipes open so data flows instantly.
3. We use **Socket.IO** to ensure those pipes don't break, and to manage our Chat Rooms effortlessly.

**Process Flow:**

- The Express App (The basic HTTP worker)
- The Socket Engine (The TCP tunnel)
- The Server Bootstrapper (The Multi-Core Traffic Cop)
