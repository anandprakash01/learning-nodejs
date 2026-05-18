# 🚀 Node.js Learning & Mastery

Welcome to my comprehensive Node.js learning repository. This project is a microscopic, exhaustive deep dive into core Node.js mechanics, web frameworks, and enterprise-grade distributed architecture.

The primary goal of this repository is to build an unshakable foundation for building scalable, high-performance backend applications—from understanding foundational APIs to deploying production-ready distributed systems.

## 📑 Table of Contents

- [🛠️ Tech Stack \& Environment](#️-tech-stack--environment)
- [🏗️ The Architectural Journey](#️-the-architectural-journey)
- [📚 Curriculum \& Directory Structure](#-curriculum--directory-structure)
  - [📦 Module 01: Core Node.js Concepts](#-module-01-core-nodejs-concepts)
  - [🌐 Module 02: Express.js — Standard MVC](#-module-02-expressjs--standard-mvc)
  - [⚡ Module 03: Distributed-Nexus — Enterprise Architecture](#-module-03-distributed-nexus--enterprise-architecture)
- [🚀 Getting Started \& Usage](#-getting-started--usage)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone the Repository](#2-clone-the-repository)
  - [3. Module Execution](#module-execution)
- [📖 Additional Resources](#-additional-resources)
- [👤 Author](#-author)

---

## 🛠️ Tech Stack & Environment

- **Core Language:** JavaScript (ES6+)
- **Runtime Environment:** Node.js
- **Web Framework:** Express.js
- **Real-time Engine:** Socket.IO
- **Recommended IDE:** Visual Studio Code

## 🏗️ The Architectural Journey

This curriculum is strictly structured to demonstrate the evolution of a backend system. Rather than just jumping into a framework, the repository progresses through three distinct evolutionary phases:

1. **Foundation (Core APIs):** Understanding the event-driven runtime without abstractions.
2. **Web Development (Standard MVC):** Building scalable REST APIs using the synchronous request-response lifecycle.
3. **Enterprise Scale (Distributed-Nexus):** Breaking the limitations of MVC using background jobs, queues, and event-driven micro-architecture.

---

## 📚 Curriculum & Directory Structure

### 📦 Module 01: Core Node.js Concepts

Learn the foundational Node.js APIs and understand how the asynchronous Event Loop actually works under the hood.

<details>
<summary><b>📂 Core Modules Breakdown</b></summary>

- **`01_os_module.js`** — System information (`os.cpus()`, `os.arch()`) and `process.env` configuration.
- **`02_fs_module.js`** — File system operations (synchronous, callback, and promise-based I/O).
- **`03_event_module.js`** — The `EventEmitter` class, custom events, and the Pub/Sub pattern.
- **`04_http_module.js`** — Building raw HTTP servers, parsing streams, and sending responses without frameworks.
</details>

**🎯 Learning Goals:**  
✅ Understand the V8 Event Loop and how it handles async operations.  
✅ Master core modules: OS, FS, Events, HTTP.  
✅ Learn how a single blocking operation (`Sync` methods) stalls the entire server.  
✅ See exactly why frameworks like Express exist as abstractions over raw HTTP.

---

### 🌐 Module 02: Express.js — Standard MVC

Build scalable web applications using Express.js, exploring routing, middleware pipelines, and strict directory structures.

#### 🔄 The MVC Request Pipeline

    [ HTTP Request ]
          ⬇
    [ Middlewares  ] (Logging, Auth, Zod Validation)
          ⬇
    [   Router     ] (Endpoint mapping)
          ⬇
    [ Controller   ] (Request orchestration)
          ⬇
    [   Service    ] (Core business logic)
          ⬇
    [    Model     ] (Database execution)
          ⬇
    [ HTTP Response] (Blocks until complete)

**🎯 Learning Goals:**  
✅ Build a complete RESTful API with proper separation of concerns.  
✅ Master middleware pipelines and centralized error handling.  
✅ Implement strict input validation.  
✅ Recognize the limit: _When side-effects (like sending emails) block the Event Loop, performance degrades unpredictably._

---

### ⚡ Module 03: Distributed-Nexus — Enterprise Architecture

Scale beyond standard MVC limitations using the distributed, event-driven architecture patterns relied upon by tech giants.

#### 🏗️ Why Distributed?

Standard MVC breaks at scale. If 10,000 users register simultaneously, sending 10,000 welcome emails synchronously will crash the Event Loop.
**Solution:** Decouple side-effects from HTTP responses using message brokers and background workers.

#### 🔄 Distributed Request Flow

    [ HTTP Request ]
          ⬇
    [ Controller   ] (Quick validation)
          ⬇
    [   Service    ] (Core business logic)
          ⬇
    [  Repository  ] (DB abstraction layer) ➔ [ Database ]
          ⬇
    [ HTTP 201 OK  ] (Immediate Response to User)
          ⬇
      ... Meanwhile, asynchronously ...
          ⬇
    [ Worker Thread] (Processes heavy task: Email, File, etc.)
          ⬇
    [ Event Emitter] (Publishes "job.complete" to other services)
          ⬇
    [  WebSockets  ] (Pushes real-time update to User via Socket.IO)

**🎯 Learning Goals:**  
✅ Implement the **Repository Pattern** to abstract database logic.  
✅ Implement internal Event-Driven communication between micro-services.  
✅ Keep the Node.js Event Loop perfectly responsive under extreme load.

---

## 🚀 Getting Started & Usage

### 1. Prerequisites

To run these modules locally, you will need the following installed:

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)
- [Redis](https://redis.io/) (Required for Module 03 queues)
- [Visual Studio Code](https://code.visualstudio.com/) (Recommended IDE)
- [Postman](https://code.visualstudio.com/) (Recommended API client)

### 2. Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/anandprakash01/learning-nodejs.git

cd learning-nodejs
```

### 3. Module Execution

**Step 1: Start the Server**

If you are using VS Code, you can open the project and run these commands directly inside the integrated terminal (`Ctrl + \``).

```bash
# Navigate to the specific module
cd 01_nodejs

# Install dependencies
npm install

# Run in development mode (auto-restarts with nodemon)
npm run dev

# Or run production mode
npm start
```

---

#### Step 2: Test the API Responses (Modules 2 & 3)

Once your Express server or Distributed backend is running, you will need an API client to interact with the endpoints.

1. Open **Postman** (or Insomnia / Thunder Client).
2. Create a new HTTP request (`GET`, `POST`, `PUT`, `DELETE`).
3. Enter the local server URL (e.g., `http://localhost:3000/api/v1/users`).
4. Add any necessary JSON bodies or Auth headers in the request configuration.
5. Hit **Send** to view the structured JSON response, inspect network headers, and test your error boundaries!

---

## 📖 Additional Resources

See [LEARNING_LOG.md](./LEARNING_LOG.md) for detailed architectural notes on:

- `package.json` dependency physics and module resolution.
- V8 Engine heap management and memory constraints.
- Deep-dive comparisons between MVC and Distributed messaging.

---

## 👤 Author

**Anand Prakash**

- **GitHub:** [@anandprakash01](https://github.com/anandprakash01)

_Continuously evolving as I explore the deeper layers of backend architecture._
