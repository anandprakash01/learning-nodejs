# Zod: The Front-Door Bouncer (Fail-Fast)

We use a library called **Zod**. Zod is a Schema Validator. It builds a microscopic firewall around your variables before your application is allowed to use them. Zod creates a strict mathematical mold (a Schema) of what the JSON must look like.

Zod is a "Schema Declaration" library. It works by chaining physical rules together. We place Zod at the absolute front of the route, before the Controller.

- **How it works:** Zod takes the incoming `req.body` and tries to force it through the mathematical mold.
- **The Physics:** If the user sends a string instead of a number, or if they miss a required field, Zod throws an error in 0.001 milliseconds. The request never reaches the Controller. The V8 heap is protected from garbage data.

---

## 1. Shape Definitions

- **`z.object({ ... })`**: Tells V8 memory, _"I am expecting a strict JSON object/dictionary. If the user sends an array or a raw string, instantly reject it."_
- **`z.string()` / `z.number()` / `z.boolean()`**: The primitive types.
- **The Chain**: You attach rules to the end of primitives. For example, `z.string().min(8).max(32)`. If the string is 7 characters, Zod violently rejects it.

---

## 2. The Execution Methods

This is the most critical distinction in Zod. When you are ready to test the data against the rules, you must choose one of these two execution methods.

| Method                       | The Bouncer Style          | How it Works                                                                                                                                   | Return / Outcome                                                                                                 |
| :--------------------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **`schema.parse(data)`**     | **The Aggressive Bouncer** | If the data is bad, it physically "throws" a native JavaScript Error. It stops the V8 thread immediately. Best used inside `try/catch` blocks. | Returns the clean data, or throws an error.                                                                      |
| **`schema.safeParse(data)`** | **The Diplomatic Bouncer** | It never throws an error. It always returns a result object.                                                                                   | **Success:** `{ success: true, data: { name: "Anand" } }`<br>**Failed:** `{ success: false, error: [ZodError] }` |

---

## 3. Validating Environment Variables (Fail-Fast Boot)

We read the `process.env` strings **EXACTLY ONCE** during the V8 boot sequence. We pass them through a rigid mathematical schema (`zod`).

1. If a variable is missing, we intentionally CRASH the server before it binds to the TCP port.
2. If it succeeds, we freeze the object and export it. The rest of the application imports this file instead of reading `process.env` directly.

```javascript
import {z} from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]), // Added standard envs
  PORT: z.coerce.number().min(1024).max(65535).default(3000), // Converts the string to a number
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

## 4. Stages of Zod Validation

When you pass custom errors into Zod, it is crucial to understand its sequential evaluation process.

### Stage 1: Does the field exist?

Before Zod checks if a value is a string or a number, it checks if the client sent the key at all.

- **The Payload:** `{ "email": "test@test.com" }` _(Notice `name` is completely missing)_
- **What Zod sees:** `undefined`
- **The Result:** Zod stops immediately and throws your exact custom message for a missing field (e.g., "Name is required").

### Stage 2: Is it the right data type?

If the field exists, Zod checks if it matches the base type you declared (e.g., `z.string()`). By default, if someone sends a number, Zod throws a generic _"Expected string, received number"_.

- **The Payload:** `{ "name": 12345 }`
- **What Zod sees:** A number.
- **The Result:** If you don't provide a custom message, Zod uses its default. To catch this elegantly, you pass a custom configuration object or function into the base type method.

### Stage 3: Does it pass the specific rules? (`.min()`, `.max()`, etc.)

If the field exists AND it is the correct data type, Zod moves down the chain to your specific chained rules.

- **The Payload:** `{ "name": "A" }`
- **What Zod sees:** A string, but the length is 1.
- **The Result:** It passes Stages 1 and 2, but fails Stage 3. It throws: "Name must be at least 2 characters".

---

## 5. Core Concepts & Gotchas

> ### 🚨 The "Empty String" Gotcha
>
> A very common point of confusion for developers learning Zod is how it handles empty strings.
>
> If a frontend developer accidentally submits an empty form, the payload looks like this: `{ "name": "", "email": "" }`.
> If you parse this payload, your required error will **NOT trigger.** Why? Because the key `name` exists in the object, and `""` is technically a valid JavaScript string. It passes Stage 1 and Stage 2! Instead, it will fail at Stage 3 and trigger your `.min()` rule.

### How `.email()` Works

The `.email()` method is a built-in convenience function in Zod that acts as a strict format checker. Behind the scenes, it simply runs a Regular Expression (Regex) test against the string. Zod only checks the **syntax** (the spelling/format). It does **not** check if the email actually exists in the real world.

> ### ⚠️ Zod v4 Standard & Deprecations
>
> If you are using or upgrading to Zod v4, the old `invalid_type_error` and `required_error` parameters have been dropped. These were hastily added years ago as a less verbose alternative to `errorMap`, but they came with footguns and do not align with Zod's actual issue codes.
>
> **Zod 4 (New Standard):**
> Validation errors can now be cleanly represented with the new `error` parameter. The `error` param optionally accepts a function (an error map) that runs at parse time to evaluate exactly _why_ the validation failed.
>
> ```javascript
> z.string({
>   error: issue =>
>     issue.input === undefined ? "This field is required" : "Not a string",
> });
> ```

---

## 6. Implementation Details

### Step 1: Define the Schema (📄 `src/validations/userValidation.js`)

Here is how you define the schema using the modern Zod v4 syntax. We nest the fields inside a body object because Express stores incoming JSON payloads in `req.body`.

```javascript
import {z} from "zod";

export const registerSchema = z.object({
  // We nest it inside "body" because Express stores it in req.body
  body: z.object({
    name: z
      .string({
        error: issue =>
          issue.input === undefined ? "Name is required" : "Name must be text",
      })
      .min(5, "Name must be at least 5 characters"),

    email: z
      .string({
        error: issue =>
          issue.input === undefined ? "Email is required" : "Email must be valid text",
      })
      .email("Invalid email address format"),

    password: z
      .string({
        error: issue =>
          issue.input === undefined ? "Password is required" : "Password must be text",
      })
      .min(8, "Password must be 8 characters long"),

    role: z.enum(["user", "guide", "admin"]).optional(),
  }),
});
```

### Step 2: Build the Middleware Interceptor (📄 `src/middlewares/validate.js`)

This middleware catches the incoming HTTP request and forces it through the Zod mold using the `.parse()` method.

> **Important Version Note:** > \* **In Zod v3**, the array of failed rules lived in `err.errors`.
>
> - **In Zod v4**, the library authors removed `.errors` to clean up the codebase. Failed rules are now strictly located inside `err.issues`.

```javascript
import AppError from "../utils/AppError.js"; // Adjust path to your custom error class

export const validate = schema => {
  return (req, res, next) => {
    try {
      // Pass the Express request objects into the Zod schema
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // If no error is thrown, the data is perfect. Let it through.
      next();
    } catch (err) {
      // 🚨 Look for .issues first (v4), fallback to .errors (v3), or default to empty array
      const validationIssues = err.issues || err.errors || [];

      // Map through all errors and combine them into a single string
      const errMessages = validationIssues.map(issue => issue.message).join(", ");

      // Pass the combined string of errors to your global error handler
      next(new AppError(`Validation failed: ${errMessages}`, 400));
    }
  };
};
```

### Step 3: Wire it to the Router (📄 `src/routes/userRoutes.js`)

```javascript
import {validate} from "../middlewares/validate.js";
import {registerSchema} from "../validations/userValidation.js";

router.post("/register", validate(registerSchema), registerUser);
```

### The Default Physics: "Stripping"

In our middleware interceptor, we forced Zod to look at all three Express inputs:

```javascript
schema.parse({
  body: req.body,
  query: req.query,
  params: req.params,
});
```

**Question:** But in our `registerSchema`, we only defined `body`. How do `query` and `params` parse?

**Answer:** _**By default, Zod is designed to be a "stripper."**_ If you pass `query` and `params` into `schema.parse()`, but your schema only defines rules for the `body`, Zod simply ignores `query` and `params`. It doesn't throw an error; it just says, _"I wasn't told to care about these, so I won't."_
