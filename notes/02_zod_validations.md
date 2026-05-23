# Zod: The Front-Door Bouncer (Fail-Fast)

We use a library called **Zod**. Zod is a Schema Validator. It builds a microscopic firewall around your variables before your application is allowed to use them.
Zod creates a strict mathematical mold (a Schema) of what the JSON must look like.

Zod is a "Schema Declaration" library. It works by chaining physical rules together.
We place Zod at the absolute front of the route, before the Controller.

- **How it works:** Zod takes the incoming `req.body` and tries to force it through the mathematical mold.
- **The Physics:** If the user sends a string instead of a number, or if they miss a required field, Zod throws an error in 0.001 milliseconds. The request never reaches the Controller. The V8 heap is protected from garbage data.

---

## 1. Shape Definitions

- **`z.object({ ... })`**: Tells V8 memory, "I am expecting a strict JSON object/dictionary. If the user sends an array or a raw string, instantly reject it."
- **`z.string()` / `z.number()` / `z.boolean()`**: The primitive types.
- **The Chain**: You attach rules to the end of primitives. For example, `z.string().min(8).max(32)`. If the string is 7 characters, Zod violently rejects it.

---

## 2. The Execution Methods (`parse()` vs `safeParse()`)

This is the most critical distinction in Zod. When you are ready to test the data against the rules, you must choose one of these two execution methods.

### `schema.parse(data)` (The Aggressive Bouncer)

- **How it works:** If the data is bad, `parse()` physically "throws" a native JavaScript Error. It stops the V8 thread immediately. (Best used inside `try/catch` blocks).

### `schema.safeParse(data)` (The Diplomatic Bouncer)

- **How it works:** It never throws an error. It always returns an object.
- **If successful:** `{ success: true, data: { name: "Anand" } }`
- **If failed:** `{ success: false, error: [ZodError] }`

---

## 3. Validating Environment Variables (Fail-Fast Boot)

We read the `process.env` strings EXACTLY ONCE during the V8 boot sequence.
We pass them through a rigid mathematical schema (`zod`).

1. If a variable is missing, we intentionally CRASH the server before it binds to the TCP port.
2. If it succeeds, we freeze the object and export it. The rest of the application imports this file instead of reading `process.env` directly.

```javascript
import {z} from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]), // Added standard envs
  PORT: z.string().transform(Number), // Converts the string to a number
  JWT_SECRET_KEY: z.string().min(10),
  JWT_EXPIRE: z.string(), // Added z.string() to fix syntax
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Missing or invalid environment variables");
}

// Freeze it so no one can mutate the env variables during runtime
export const env = Object.freeze(_env.data);
```

---

## 4. Validating Incoming Requests (`req.body`)

### Step 1: Define the Schema (📄 `src/validations/userValidation.js`)

```javascript
import {z} from "zod";

export const registerSchema = z.object({
  // We nest it inside "body" because Express stores it in req.body
  body: z.object({
    name: z
      .string({required_error: "Name is required"})
      .min(5, "Name must be at least 5 characters"),

    email: z
      .string({required_error: "Email is required"})
      .email("Invalid email address format"),

    password: z
      .string({required_error: "Password is required"})
      .min(8, "Password must be 8 characters long"),

    role: z.enum(["user", "guide", "admin"]).optional(),
  }),
});
```

### Step 2: Build the Middleware Interceptor (📄 `src/middlewares/validate.js`)

This is the file that catches the incoming HTTP request and forces it through the Zod mold. Notice we are using `parse()`.

```javascript
export const validate = schema => {
  return (req, res, next) => {
    try {
      // We pass the Express request objects into the Zod schema.
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // If no error is thrown, the data is perfect. Let it through.
      next();
    } catch (err) {
      // e.g., "Name must be at least 2 characters, Invalid email address format"
      // const errMessages = err.errors.map(e => e.message).join(", ");

      // 🚨 THE FIX: Look for .issues first (v4), fallback to .errors (v3), or default to empty array
      const validationIssues = err.issues || err.errors || [];
      const errMessages = validationIssues.map(issue => issue.message).join(", ");

      // Pass the combined string of errors to your global error handler
      next(new AppError(`Validation failed: ${errMessages}`, 400));
    }
  };
};
```

- **In Zod v3**, when validation failed, the error object contained a property called `.errors`.
- **In Zod v4**, the architects of the library completely removed `.errors` to clean up their codebase. The array of failed rules is now strictly located inside a property called `.issues`.

### Step 3: Wire it to the Router (📄 `src/routes/userRoutes.js`)

```javascript
import {validate} from "../middlewares/validate.js";
import {registerSchema} from "../validations/userValidation.js";

router.post("/register", validate(registerSchema), registerUser);
```

We forced Zod to look at all three Express inputs:

```javascript
schema.parse({
  body: req.body,
  query: req.query,
  params: req.params,
});
```

But in our `registerSchema`, we only defined `body`.
How do `query` and `params` parse?

---

## 5. The Default Physics: "Stripping"

- **By default, Zod is designed to be a "stripper."** If you pass `query` and `params` into `schema.parse()`, but your schema only defines rules for the `body`, Zod simply ignores `query` and `params`. It doesn't throw an error; it just says, _"I wasn't told to care about these, so I won't."_
