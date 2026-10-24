# Process & Environment Variables

## 💻 System Interaction and Configuration Security

Because Node.js runs directly on your machine (or a cloud server), it needs a way to communicate with the host Operating System (OS). It achieves this through a globally available C++ binding called the `process` object.

Understanding the `process` object is critical for gracefully shutting down servers, reading terminal inputs, and securely injecting sensitive passwords into your application.

---

## 1. The `process` Global Object

`process` is a massive global object built directly into Node.js. It represents the actual C++ program running on your Operating System (Windows, Mac, or Linux). It provides information about, and control over, the current Node.js execution.

`process.env` is a specific sub-object where "env" stands for Environment Variables. Here is exactly how it gets populated:

- When Node.js boots, the Operating System allocates a block of RAM for the Node C++ engine.
- The OS takes a snapshot of its own global variables (like your username, OS version, and terminal paths) and injects them as **raw strings** into that block of RAM.
- Node.js exposes that RAM to your JavaScript code via the `process.env` object.

### A. Key Properties (System Metadata)

Properties provide metadata and real-time information about the current runtime environment.

- **`process.env`**: Returns an object containing the user environment variables.
- **`process.argv`**: Returns an array containing the command-line arguments passed when the Node.js process was launched.
  - _Index 0_: Path to the Node.js executable.
  - _Index 1_: Path to the JavaScript file being executed.
  - _Index 2+_: Any additional custom command-line arguments.

  ```javascript
  // If you run: node server.js --port 8080
  const args = process.argv.slice(2);
  console.log(args); // Output: [ '--port', '8080' ]
  ```

- **`process.pid`**: Returns the unique Process ID (PID) assigned by the operating system. Useful for tracking or killing specific processes in task managers.
- **`process.platform`**: Returns a string identifying the OS platform (e.g., `'darwin'` for Mac, `'win32'` for Windows, `'linux'`).
- **`process.arch`**: Returns the CPU architecture string (e.g., `'x64'`, `'arm64'`).
- **`process.version`**: Returns the current Node.js version string (e.g., `'v20.6.0'`).

### B. Core Methods (Process Control)

Methods allow you to interact with, measure, or alter the behavior of the running process.

- **`process.exit([code])`**: Terminates the process synchronously. Passing `0` indicates a successful completion, while any non-zero code (like `1`) signals a fatal error.

  It instantly destroys the Event Loop, drops all pending database calls, and shut down the V8 engine immediately.

  When a Node app finishes executing, it returns a status code to the operating system.
  - `process.exit(0)`: Indicates a **Success**. The program finished cleanly.
  - `process.exit(1)`: Indicates a **Fatal Failure**. The program crashed due to an unhandled exception or unhandled rejection.

By default, calling process.exit() is the exact same thing as calling process.exit(0). It tells the Operating System: "I am shutting down, and everything went perfectly fine. There are no errors."

_(The only exception is if you previously set process.exitCode = 1 somewhere else in your file. If you did that, process.exit() will use that stored number instead)._

```javascript
if (!process.env.DB_PASSWORD) {
  console.error("Fatal Error: Missing Database Password");
  process.exit(1); // Instantly crashes the app so it doesn't run in a broken state
}
```

- **`process.cwd()`**: Returns the Current Working Directory of the Node.js process.
  - _Crucial Distinction:_ `process.cwd()` is where you _ran the terminal command from_. `__dirname` is where the _actual file lives_ on the hard drive. If you run `node src/app.js` from your desktop, `cwd()` is the Desktop, but `__dirname` is the `src` folder.

- **`process.nextTick(callback)`**: Defers the execution of the callback function until the _next pass_ of the event loop. It runs before any other I/O events or timers trigger.\
  It means giving a function a VIP pass to jump to the very front of the execution line.
  In Node.js, the Event Loop handles tasks in specific phases (like checking for network requests, then checking for timers, then checking the database).\
  When you use `process.nextTick()`, you are telling Node: "Finish exactly the line of code you are running right this second. But before you move on to check timers or talk to the database, run this function first."

- _How it works:_ It puts your callback at the absolute front of the microtask queue. It will execute immediately after the current synchronous code finishes, beating Promises and `setTimeout`.

```javascript
console.log("1. Sync execution starts");

setTimeout(() => console.log("4. Timer (Macrotask)"), 0);

Promise.resolve().then(() => console.log("3. Promise (Microtask)"));

process.nextTick(() => console.log("2. nextTick (Highest Priority Microtask)"));

// Output order: 1, 2, 3, 4
```

- **`process.memoryUsage()`**: Returns an object describing the memory usage of the Node.js process measured in bytes.

  ```javascript
  console.log(process.memoryUsage());
  /* Output:
  {
    rss: 4935680,       // Resident Set Size: Total memory allocated for the process execution
    heapTotal: 1826816, // Total size of the allocated heap
    heapUsed: 650472,   // Actual memory used by your JavaScript objects
    external: 49879,    // Memory used by C++ objects bound to JavaScript objects
    arrayBuffers: 9386  // Memory allocated for buffers
  }
  */
  ```

- **`process.hrtime.bigint()`**: Returns the current high-resolution real time in nanoseconds. Crucial for enterprise performance benchmarking.

  ```javascript
  const start = process.hrtime.bigint();
  // ... run heavy database query ...
  const end = process.hrtime.bigint();
  console.log(`Query took ${Number(end - start) / 1000000} milliseconds`);
  ```

### C. Standard I/O (Input/Output) Streams

The process object exposes streams to communicate directly with the OS terminal interface.

- **`process.stdout`**: A Writable stream (sending standard text data to the terminal). `console.log()` is actually just a wrapper around this.

  ```javascript
  process.stdout.write("Hello from the OS terminal!\n");
  ```

- **`process.stdin`**: This is a readable stream that actively listens for keystrokes in the terminal. It is commonly used when building CLI (Command Line Interface) tools where you need to ask the user a question and wait for their response.

```js
console.log("What is your name?");

// Listen for the 'data' event, which triggers when the user presses Enter
process.stdin.on("data", data => {
  // Data comes in as a Buffer, so we convert it to a string and trim whitespace/newlines
  const input = data.toString().trim();

  console.log(`Hello, ${input}!`);

  // Close the input stream so the program can exit, otherwise it listens forever
  process.exit();
});
```

- **`process.stderr`**: While process.stdout (what console.log uses) is for normal messages, `process.stderr` is a separate channel specifically for errors. `console.error()` is actually just a wrapper around `process.stderr.write()`.

```js
// Normal output (goes to stdout)
process.stdout.write("Server started successfully on port 3000.\n");

// Error output (goes to stderr)
process.stderr.write("CRITICAL FAILURE: Database connection lost!\n");
```

---

## 2. Process Events & Graceful Shutdowns (EventEmitter)

Because the `process` object inherits from the `EventEmitter` class, you can listen for lifecycle events and system signals using `process.on()`. This is mandatory for enterprise stability.

- **`uncaughtException`**: Emitted when a synchronous error bubbles all the way back to the event loop without being caught in a `try/catch`.

  ```javascript
  process.on("uncaughtException", err => {
    console.error("UNCAUGHT EXCEPTION! Shutting down...", err.name, err.message);
    process.exit(1);
  });
  ```

- **`unhandledRejection`**: Emitted whenever an asynchronous Promise is rejected and no `.catch()` handler is attached.

  ```javascript
  process.on("unhandledRejection", err => {
    console.error("UNHANDLED REJECTION! Shutting down...", err.name, err.message);
    // Give the server time to finish pending requests before crashing
    server.close(() => {
      process.exit(1);
    });
  });
  ```

- **POSIX Signals (`SIGINT`, `SIGTERM`)**: Sent by the OS when a user or system tries to close the program. Pressing `Ctrl+C` triggers `SIGINT`. In enterprise environments (like Docker or Kubernetes), orchestrators send `SIGTERM` before pulling the plug.

  **Example: Graceful Shutdown**
  You must intercept these signals to close database connections safely before exiting, otherwise data corruption can occur.

  ```javascript
  import mongoose from "mongoose";

  // Fired when you press Ctrl+C or a container receives a shutdown command
  process.on("SIGINT", async () => {
    console.log("Shutdown signal received. Closing database...");
    await mongoose.connection.close();
    console.log("Database disconnected. Goodbye!");
    process.exit(0);
  });
  ```

---

## 3. Environment Variables (`process.env`)

`process.env` is a specific sub-object where "env" stands for Environment Variables. Here is exactly how it gets populated:

- When Node.js boots, the Operating System allocates a block of RAM for the Node C++ engine.
- The OS takes a snapshot of its own global variables (like your username, OS version, and terminal paths) and injects them as **raw strings** into that block of RAM.
- Node.js exposes that RAM to your JavaScript code via the `process.env` object.

Applications run in different environments: your local laptop (`development`), a testing server (`staging`), and the live internet (`production`).

You never want to hardcode database URLs or API keys directly into your JavaScript files because:

1. **Security:** If you push hardcoded keys to GitHub, bots will steal them and exploit your accounts within seconds.
2. **Flexibility:** You would have to manually change the code every time you move from local testing to production.

The OS provides an environment dictionary accessed via `process.env`.

```js
// Reading a variable injected by the Operating System
const dbPassword = process.env.DB_PASSWORD;
const port = process.env.PORT || 3000;
```

## 4. The `.env` File & `dotenv`

To manage these variables locally without hardcoding them, developers use `.env` files.

**🚨 CRITICAL RULE:** The `.env` file MUST ALWAYS be added to your `.gitignore` file. It should never be uploaded to source control.

### The Standard Architecture (dotenv)

Historically, Node.js could not read `.env` files natively. You had to install the `dotenv` package.

```js
// 1. Install the package
npm install dotenv

// 2. Create a .env file at the root of your project
PORT=8080
MONGO_URI=mongodb+srv://admin:supersecret@cluster0.mongodb.net
JWT_SECRET=my_ultra_secure_hash

// 3. Inject it at the very top of your main server file
import dotenv from 'dotenv';
dotenv.config(); // This loads the .env file into process.env
// or
import "dotenv/config"

console.log(`Server starting on port: ${process.env.PORT}`);
```

### How `dotenv` Actually Works

`dotenv` is a **"File System to RAM" injector**. It allows you to write your secrets in a physical text file (`.env`), and it mimics the Operating System by injecting those secrets directly into the live `process.env` memory space.

When you run `import 'dotenv/config'`, it triggers an automatic script behind the scenes:

1. **File System Read:** It uses Node's native `fs` module to scan your hard drive for a file literally named `.env`.
2. **String Parsing:** It reads the entire file as one giant text string. It splits the string at every new line, and then splits each line at the `=` sign.
3. **The Mutation:** It takes the left side of the `=` (the key) and the right side (the value) and literally executes a memory mutation: `process.env[key] = value`.

#### What it returns

```javascript
// if successful:
{
  parsed: { PORT: '3000', MONGO_URI: 'mongodb://...' }
}

// If it fails (no .env file found), it returns an error:
{
  error: Error('ENOENT: no such file')
}
```

---

### The "Amateur Mistake"

Many developers scatter calls like `process.env.PORT` or `process.env.JWT_SECRET` throughout hundreds of files in their codebase.

If a DevOps engineer forgets to set a specific variable in the production container, the server will boot up normally, but will crash days later when a specific line of code tries to access that missing secret. **This is a tracing nightmare.**

---

### The Next Step: Schema Validation (Zod)

Now that `dotenv` has injected our `.env` file into `process.env`, we have a massive security and stability problem: **`process.env` ONLY understands strings.** For example, `process.env.PORT` is the text string `"3000"`, not a number. If we require a boolean value or a strict number, we need to parse and validate this data before our app runs.

To solve both the scattered variable problem and the string problem, we use a schema validator library called **Zod**.

### The Modern Architecture (Node v20.6+)

As of Node.js v20.6.0, the runtime natively supports `.env` files! You no longer need to install the `dotenv` package if you are using modern Node.

You simply pass a flag when starting your server in the terminal:

```js
node --env-file=.env server.js
```

## 5. `NODE_ENV` (The Master Switch)

There is one environment variable that acts as the master switch for your entire architecture: `NODE_ENV`.

Frameworks like Express automatically read `process.env.NODE_ENV`. If you set it to `production`, Express will physically alter its engine, caching templates and drastically reducing the verbosity of error messages to protect stack traces from hackers.

```js
if (process.env.NODE_ENV === "development") {
  console.log("Running in DEV mode: Detailed errors enabled.");
} else if (process.env.NODE_ENV === "production") {
  console.log("Running in PROD mode: Max performance enabled.");
}
```
