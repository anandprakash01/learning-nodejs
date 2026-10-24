# V8 Engine & The Event Loop

## ⚙️ The Architecture of Node.js

Node.js is not a programming language. It is a **C++ runtime environment** that allows JavaScript to execute outside of a web browser. It is built on two primary pillars:

1. **Google's V8 Engine:** Compiles and executes JavaScript code.
2. **libuv:** A C++ library that gives Node.js access to the operating system, the file system, networking, and handles asynchronous operations.

---

## 1. The V8 Engine

The V8 engine executes JavaScript synchronously on a **single thread**. It consists of two main memory structures:

- **The Memory Heap:** Where memory allocation happens (storing objects, variables, and closures).
- **The Call Stack:** The physical data structure that records where in the program we are. If we step into a function, it is pushed onto the stack. If we return from a function, it is popped off the top.

**The Bottleneck:** Because JavaScript is single-threaded, if a function takes 5 seconds to run on the Call Stack (like reading a massive file), the entire server freezes. No other user can make a request. This is called **Blocking the Event Loop**.

---

## 2. The Solution: libuv & The Worker Pool

To prevent the server from freezing, Node.js offloads heavy, blocking tasks to **libuv**.

When you ask Node to read a file, encrypt a password, or make a network request, V8 doesn't do the work. It instantly passes the task to libuv and pops the function off the Call Stack, allowing the server to continue serving other users.

libuv maintains a **Thread Pool** (by default, 4 background C++ threads). These threads execute the heavy tasks in the background. When a task is finished, libuv pushes the callback function into the Event Loop to be executed by the main thread.

---

## 3. The Event Loop Architecture

The Event Loop is an infinite `while` loop that constantly checks if the Call Stack is empty. If it is empty, it looks at various queues to see if any background tasks have finished and are ready to execute their callbacks.

The Event Loop operates in strict, sequential **Phases**:

1. **Timers Phase:** Executes callbacks scheduled by `setTimeout()` and `setInterval()`.
2. **Pending Callbacks Phase:** Executes I/O callbacks deferred to the next loop iteration (e.g., TCP socket errors).
3. **Idle, Prepare Phase:** Used strictly internally by Node.js.
4. **Poll Phase (The Core):** Retrieves new I/O events (reading files, incoming network requests). If the Poll queue is empty, the Event Loop will often pause and wait here for new requests to arrive.
5. **Check Phase:** Executes callbacks scheduled specifically by `setImmediate()`.
6. **Close Callbacks Phase:** Executes close events (e.g., `socket.on('close', ...)`).

---

## 4. Microtasks vs. Macrotasks (The VIP Queues)

Before the Event Loop can move from one phase to the next, it must check two special VIP queues. These are the **Microtask Queues**. They have absolute priority over everything else.

1. **`process.nextTick()` Queue:** The highest priority queue in Node.js.
2. **Promises Queue:** Where `.then()`, `.catch()`, and `async/await` resolutions go.

_Engine Mechanic:_ If the Event Loop finishes the Timers phase, before it goes to the Poll phase, it will empty the _entire_ `process.nextTick()` queue, followed by the _entire_ Promises queue.

---

## 5. Proving the Execution Order

This code snippet is the ultimate test of Node.js architecture.

```javascript
console.log("1. Synchronous Code (Call Stack)");

setTimeout(() => console.log("5. Timer Phase (Macrotask)"), 0);

setImmediate(() => console.log("6. Check Phase (Macrotask)"));

Promise.resolve().then(() => console.log("4. Promise Queue (Microtask)"));

process.nextTick(() => console.log("3. nextTick Queue (Microtask VIP)"));

console.log("2. Synchronous Code (Call Stack)");
```

**The Expected Output:**

1. `1. Synchronous Code (Call Stack)` _(Executes immediately)_
2. `2. Synchronous Code (Call Stack)` _(Executes immediately)_
3. `3. nextTick Queue (Microtask VIP)` _(Microtasks execute before Event Loop phases)_
4. `4. Promise Queue (Microtask)` _(Promises execute right after nextTick)_
5. `5. Timer Phase (Macrotask)` _(Phase 1 of the Event Loop)_
6. `6. Check Phase (Macrotask)` _(Phase 5 of the Event Loop)_
