# Learning Log: Node.js Backend Development

## Package Management & Dependency Physics

### npm install Commands

```bash
# Initialize a project
npm init           # Interactive setup
npm init -y        # Use defaults

# Install packages
npm i <package>              # Install as production dependency
npm install <package>        # Same as npm i
npm i --save-dev <package>   # Install as dev dependency (shorthand: npm i -D)
```

### The Critical Difference: Production vs Development Dependencies

**The Mistake:**
```bash
npm i nodemon  # ❌ Installs to production dependencies
```
This tells the ecosystem that nodemon is required to run your business logic in production. When your DevOps pipeline builds a Docker container and runs `npm install`, it ships nodemon into production, which:
- Bloats memory footprint (thousands of lines watching OS file systems)
- Increases security surface area
- Wastes CPU watching files that never change

**The Enterprise Way:**
```bash
npm i --save-dev nodemon  # ✅ Isolates to devDependencies
```
This creates a strict environmental boundary. When production deployment runs `npm install --omit=dev`, Node.js explicitly ignores everything in devDependencies, keeping your V8 engine lean with only essential business logic.

### Why This Matters

V8 Heap Management:
- Production uses `--max-old-space-size=2048` to cap heap at 2GB
- Predictable crashes are better than silent OOM lockups
- Garbage Collector must keep up with network streams; bloated dependencies cause GC pressure

---

## V8 Engine & Memory Constraints

### The Problem

Amateurs run: `node server.js`  
This leaves the V8 engine without strict memory constraints, leading to:
- Silent Out-Of-Memory (OOM) crashes when GC can't keep up
- Version locking failures (libuv behavior changes across developer machines)
- Unpredictable performance in production

### The Enterprise Solution

1. **V8 Heap Boundaries**
   ```bash
   node --max-old-space-size=2048 server.js
   ```
   Strictly cap the V8 heap at 2GB. If it hits the limit, it crashes predictably rather than locking up the entire OS host.

2. **Native Debugging**
   ```bash
   node --inspect server.js
   ```
   Allows VS Code debugger to attach directly to the libuv event loop for step-through memory analysis.

3. **Engine Locking**
   Enforce Node.js >= 20.0.0 in package.json to guarantee specific Stream API and Worker Thread capabilities.

---

## Architectural Patterns

### Pattern 1: The Standard MVC Architecture

**Used for:** Small to medium applications (thousands of users)

**The Flow:**
```
HTTP Request
    ↓
Router
    ↓
Controller (orchestration)
    ↓
Service (business logic)
    ↓
Database Model
    ↓
Response (blocks until complete)
```

**Physics:** Everything is synchronous within the main V8 thread. When a user registers:
1. Service hashes password
2. Saves to MongoDB
3. Sends welcome email
4. Then responds to user

**The Limit:** At 100,000+ concurrent users, sending emails during HTTP requests blocks the libuv thread pool → server crashes.

### Pattern 2: The Distributed Enterprise Architecture

**Used for:** Large-scale systems (tech giants, 100K+ users)

**Key Components:**

#### 📁 Repositories/ (Database Boundary)
- Abstracts data access from business logic
- Standard MVC: Services talk directly to Mongoose
- Advanced: Repository wraps all database interactions
- **Benefit:** Switch MongoDB → PostgreSQL by rewriting only the Repository; Services never change

#### 📁 Queues/ & 📁 Jobs/ (Background Workers)
- Decouples HTTP response from side effects
- When user registers:
  1. Controller validates input
  2. Saves user to database
  3. Pushes "send_email" event to Redis queue (BullMQ)
  4. Returns `201 Created` immediately
  5. Background worker picks up job, sends email silently
- **Benefit:** Keeps V8 thread pool free; responsive to new requests

#### 📁 Events/ (Internal Pub/Sub)
- Different system parts communicate without importing each other
- Replaces direct module imports with event-driven messaging
- **Benefit:** Extreme decoupling; services can scale independently

**The Philosophy:** "Introduce extreme decoupling to protect the V8 engine at all costs."

---

## Debugging & Development

### VS Code Debugger Integration

Attach debugger to running Node process:
```bash
node --inspect server.js
```
Then in VS Code: Run → "Attach to Node Process"

This gives you:
- Breakpoints
- Step-through execution
- Memory profiling
- Real-time variable inspection

---

## Summary: The Learning Path

1. **Module 1 (01_nodejs):** Understand V8, event loops, and core APIs
2. **Module 2 (02_expressjs):** Build HTTP applications with proper dependency management
3. **Module 3 (03_distributed-nexus):** Implement enterprise patterns for scale

**Core Principle:** Think in systems. A single line of code blocks the entire event loop. Every decision impacts thousands of concurrent requests.
