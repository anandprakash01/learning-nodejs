const fs = require("fs/promises");
const Events = require("events");

const myEmitter = new Events.EventEmitter();

const path = "./src/log/";

// Listen to the event

myEmitter.on("signalChange", async e => {
  // e => signalColor
  // console.log(e);

  const msg = `${new Date().toLocaleString()} Signal changed to ${e}.\n`;

  try {
    await fs.appendFile(path + "signal.log", msg);
    console.log("Signal Changed to " + e);
  } catch (err) {
    console.log("ERROR WHILE WRITING LOG", err);
  }
});

// Emit an event
const emit = () => {
  const signalColors = ["GREEN🟢", "YELLOW🟡", "RED🔴"];
  let counter = 0;
  setInterval(() => {
    const idx = counter % 3;
    counter++;
    myEmitter.emit("signalChange", signalColors[idx]);
    // in every 1 min it will emit an event
  }, 60000);
};
emit();

/* =============================================================

Node.js is built on the Observer Pattern. Objects (Emitters) broadcast messages across the V8 memory heap, and other functions (Listeners) wait to intercept them.

The "Mistake": 
Amateurs believe that Node.js events are asynchronous (like a database call). They are NOT. The native `EventEmitter` is entirely SYNCHRONOUS. If your listener contains a heavy `while` loop, the `emit` function will block the entire V8 CPU thread until the listener finishes.

The "Enterprise Way": 
We use events to decouple systems. In this example, the Authentication logic does not need to know how the Audit Logger works. It just shouts into the void, and the Logger listens.
=============================================================
*/

// We create a class that INHERITS the physics of the EventEmitter.
// This is exactly how the 'http' module builds the 'req' and 'res' objects.
class SecuritySystem extends Events {}

// Instantiate a single object in the V8 heap
const security = new SecuritySystem();

// ==========================================
// THE LISTENERS (Waiting in Memory)
// ==========================================

// Listener 1: The Audit Trail
security.on("login_success", async userData => {
  const msg = `[AUDIT] Writing to log: User ${userData.email} accessed the system\n`;
  try {
    await fs.appendFile(path + "user.log", msg);
    console.log(`[AUDIT] Writing to log: User ${userData.email} accessed the system.`);
  } catch (err) {
    console.log("ERROR WHILE WRITING LOG", err);
  }
});

// Listener 2: The Email Service
security.on("login_success", async userData => {
  const msg = `[EMAIL] Dispatching welcome email to ${userData.email}...\n`;

  try {
    await fs.appendFile(path + "user.log", msg);
    console.log(`[EMAIL] Dispatching welcome email to ${userData.email}...`);
  } catch (err) {
    console.log("ERROR WHILE DISPATCHING EMAIL", err);
  }
});

// ==========================================
// THE TRIGGER (Execution Thread)
// ==========================================

console.log("--- V8 Main Thread Starting ---");

const incomingUser = {email: "anand@enterprise.com", role: "admin"};

console.log(`Authenticating ${incomingUser.email}...`);

// The `.emit()` function halts the current thread, executes Listener 1, then executes Listener 2, and ONLY THEN returns to this line.
security.emit("login_success", incomingUser);

console.log("--- V8 Main Thread Finished ---");
