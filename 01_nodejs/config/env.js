/* ===========================================================================
THE ARCHITECT'S NOTES: config/env.js (The Fail-Fast Memory Boundary)
===========================================================================
When Node.js boots, the OS injects environment variables as raw strings into the C++ memory space at `process.env`. 

The "Mistake": 
Amateurs scatter `process.env.PORT` or `process.env.JWT_SECRET` throughout hundreds of files. If a DevOps engineer forgets to set a variable in the production container, the server boots normally, but crashes days later when a specific line of code tries to access the missing secret. This is a tracing nightmare.

The "Enterprise Way" (Fail-Fast Architecture): 
We read the `process.env` strings EXACTLY ONCE during the V8 boot sequence. 
We pass them through a rigid mathematical schema (`zod`). 
1. If a variable is missing, we intentionally CRASH the server before it binds to the TCP port.
2. If it succeeds, we freeze the object and export it. The rest of the application imports this file instead of reading `process.env` directly.
===========================================================================
*/

// 1. Load the raw strings from the .env file into the V8 process memory
require("dotenv").config();
const {z} = require("zod");

// 2. Define the exact physical constraints of our environment
// z.object({ ... }) defines the strict shape of the memory object we expect.
// process.env is a chaotic, untyped C++ dictionary inherited from the Operating System. By defining z.object, we are telling the V8 engine to allocate a new, highly structured block of memory that will only accept the exact keys we define. Everything else the OS injected is ignored, protecting our application from memory bloat.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // z.enum(["development", "production", "test"]) It forces the NODE_ENV variable to be one of these three exact strings.

  // `z.coerce.number()` converts the incoming string representation of a number "3000" into an actual JavaScript Number.
  PORT: z.coerce.number().min(1024).max(65535).default(3000),
  // .min(1024).max(65535) Restricts the port number to a valid range
});

// 3. Execute the Validation (The Fail-Fast Gatekeeper)
const _env = envSchema.safeParse(process.env);
// .safeParse(process.env) (Error Boundary)
// Zod also has a regular .parse() method, but if it fails, it throws an unhandled synchronous exception. This forces the V8 engine to immediately build an expensive stack trace and panic. .safeParse() is the enterprise way. It executes without throwing exceptions. It simply returns a predictable object: { success: true, data: ... } or { success: false, error: ... }

if (!_env.success) {
  console.error("❌ CRITICAL: Invalid or missing Environment Variables.");
  console.error(_env.error.format());

  // It forcefully terminates the Node.js application.
  process.exit(1);
}

// 4. Freeze the validated memory object so it cannot be mutated at runtime
const env = Object.freeze(_env.data);

module.exports = env;
