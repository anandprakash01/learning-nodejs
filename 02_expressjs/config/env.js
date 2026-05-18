/* ===================================================
NOTES: config/env.js (The Fail-Fast Memory Boundary)
=================================================== */
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
  MONGO_URI: z.string().url().startsWith("mongodb"),
  JWT_SECRET_KEY: z.string().min(10), // Must be at least 10 characters for security
  JWT_EXPIRE: z.string().default("30d"),
});

// 3. Execute the Validation (The Fail-Fast Gatekeeper)
const _env = envSchema.safeParse(process.env);
// .safeParse(process.env) (Error Boundary)
// Zod also has a regular .parse() method, but if it fails, it throws an unhandled synchronous exception. This forces the V8 engine to immediately build an expensive stack trace and panic. .safeParse() is the enterprise way. It executes without throwing exceptions. It simply returns a predictable object: { success: true, data: ... } or { success: false, error: ... }

if (!_env.success) {
  console.error("❌ CRITICAL: Invalid or missing Environment Variables.");
  console.error(_env.error.format());
  process.exit(1);
}

// 4. Freeze the validated memory object so it cannot be mutated at runtime
const env = Object.freeze(_env.data);
// this final env has final direct env environment variables object

export default env;
