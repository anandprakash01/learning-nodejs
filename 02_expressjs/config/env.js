/* ===================================================
NOTES: config/env.js (The Fail-Fast Memory Boundary)
===================================================

Environment variables in Node.js are key-value pairs used to configure applications dynamically, accessed via `process.env`.
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

// 1. Load the raw strings from the .env file into the V8 process memory by importing dotenv/config
import "dotenv/config";
import {z} from "zod";

// Note:: process.env gives all the environment variables available including os variables
// console.log(typeof process.env.PORT); // string

// z.object({ ... }) defines the strict shape of the memory object we expect.
// process.env is a chaotic, untyped C++ dictionary inherited from the Operating System. By defining z.object, we are telling the V8 engine to allocate a new, highly structured block of memory that will only accept the exact keys we define. Everything else the OS injected is ignored, protecting our application from memory bloat.

// z.enum(["development", "production", "test"]) It forces the NODE_ENV variable to be one of these three exact strings.
// `z.coerce.number()` converts the incoming string representation of a number "3000" into an actual JavaScript Number.
// z.string(): Checks the V8 memory type. If MONGO_URI is a number or a boolean, it crashes immediately. It must be text.
// .url(): This is a powerful built-in Regex (Regular Expression) engine inside Zod. It mathematically scans the string to ensure it has a valid protocol (://) and domain structure. It prevents typos like mongodb/127.0.0.1.

// ----- process
// => Inspection: Zod looks at the raw process.env object.
// => Defining: defining variables provided as schema.
// => Security Stripping: Zod strips away everything else in process.env that you didn't ask for. It creates a brand new, isolated memory object containing ONLY the variables you defined.

// 2. Define the exact physical constraints of our environment
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.coerce.number().min(1024).max(65535).default(3000),

  // MONGO_URI: z.string().url().startsWith("mongodb"),// deprecated
  // MONGO_URI: z.string().startsWith("mongodb"),
  MONGO_URI: z
    .string()
    .min(1, "MongoDB URI cannot be empty")
    .regex(/^mongodb(\+srv)?:\/\//), // best way is regex
  JWT_SECRET_KEY: z
    .string()
    .min(32, "JWT secret key must be at least 32 characters for security"), // Must be at least 32 characters for security

  // JWT_EXPIRE: z.string().min(1, "JWT_EXPIRE cannot be empty").default("30d"),
  JWT_EXPIRE: z
    .string()
    .min(1, "JWT_EXPIRE cannot be empty")
    .regex(
      /^\d+[smhdy]$/,
      "JWT_EXPIRE must be a valid time format (e.g., '7d', '24h', '30m')",
    )
    .default("7d"),

  // date: z.coerce.date().min(new Date(), "Event date cannot be in the past"),

  // when you define a schema in a file (like event.validation.js), JavaScript reads and evaluates that file exactly once, the moment you turn the server on.

  // That means new Date() fires when the server boots up, and it is permanently frozen in memory.
  // If you start your server on Monday, and keep it running until Friday, the .min() check will still be using Monday's date! A user on Thursday could create an event for Tuesday, and Zod would let it pass because Tuesday is greater than Monday!

  date: z.coerce
    .date()
    .refine(val => val > new Date(), {message: "Event cannot be in past"}),
});

// To be cryptographically secure against brute-force attacks, the HS256 algorithm (which Express uses by default) technically requires a 256-bit key. In plain text, that means your secret should be an absolute minimum of 32 characters long.

// The regex /^\d+[smhdy]$/ acts as a strict gatekeeper to make sure your time string exactly matches what the jsonwebtoken library expects.

// Here is the exact breakdown of how it works piece by piece:
// ^ — This forces the check to start at the very first character.
// \d+ — The \d looks for a digit (0-9). The + means "one or more." This allows numbers like 7, 24, or 365.
// [smhdy] — This is a character class. It forces the very next character to be exactly one of these specific letters: seconds, minutes, hours, days, or years.
// $ — This forces the string to end immediately after that single letter.

// 3. Execute the Validation (The Fail-Fast Gatekeeper)
const _env = envSchema.safeParse(process.env);
// .safeParse(process.env) (Error Boundary)
// Zod also has a regular .parse() method, but if it fails, it throws an unhandled synchronous exception. This forces the V8 engine to immediately build an expensive stack trace and panic. .safeParse() is the enterprise way. It executes without throwing exceptions. It simply returns a predictable object: { success: true, data: ... } or { success: false, error: ... }

if (!_env.success) {
  console.log(`[FATAL] [ENV] Invalid or Missing Environment variables`);
  _env.error.issues.forEach(err => {
    console.log(`${err.path[0]} : ${err.message}`);
  });

  process.exit(1);
}

// 4. Freeze the validated memory object so it cannot be mutated at runtime
const env = Object.freeze(_env.data);
// this final env has final direct env environment variables object

export default env;
