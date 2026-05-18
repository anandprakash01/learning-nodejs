import {z} from "zod";

const registerSchema = z.object({
  body: z.object({
    name: z
      .string({required_error: "Name is required"})
      .min(5, "Name must be at least 5 characters"),

    email: z
      .string({required_error: "Email is required"})
      .trim()
      .min(1, "Email is required")
      .email("Invalid email address"),
    // .min(1, "Email is required") Catches empty string: { "email": "" }

    password: z.string().min(8, "Password must be 8 characters long"),
    role: z.enum(["user", "architect", "admin"]).optional(),
  }),
});

// When you pass { required_error: 'Name is required' } into z.string(), you are customizing the exact error message Zod throws only when the field is completely missing (undefined) from the request.

// The 3 Stages of Zod Validation
// Stage 1: Does the field exist? (required_error)
// Before Zod even checks if it's a string, it checks if the client sent the key at all.

// The Payload: { "email": "test@test.com" } (Notice name is missing completely)

// What Zod sees: undefined

// The Result: Zod stops immediately and throws your exact custom message: "Name is required".

// Stage 2: Is it the right data type? (invalid_type_error)
// If the field exists, Zod checks if it matches the base type you declared (z.string()). By default, if someone sends a number, Zod throws a generic "Expected string, received number". You can customize this in the same object!

// The Payload: { "name": 12345 }

// What Zod sees: A number.

// The Result: If you don't provide a custom message, Zod uses its default. To catch this elegantly, you pass a second argument into that object:
// z.string({ required_error: 'Name is required', invalid_type_error: 'Name must be text' })

// Stage 3: Does it pass the specific rules? (.min(), .max(), etc.)
// If the field exists AND it is a string, Zod then moves down the chain to your specific chained rules like .min(2, 'Name must be at least 2 characters').

// The Payload: { "name": "A" }

// What Zod sees: A string, but the length is 1.

// The Result: It passes Stages 1 and 2, but fails Stage 3. It throws: "Name must be at least 2 characters".

// 🚨 The "Empty String" Gotcha
// A very common point of confusion for developers learning Zod is how it handles empty strings.

// If a frontend developer accidentally submits an empty form, the payload looks like this:
// { "name": "", "email": "" }

// If you parse this payload, your required_error will NOT trigger.
// Why? Because the key name exists in the object, and "" is technically a valid JavaScript string. It passes Stage 1 and Stage 2!

// Instead, it will fail at Stage 3 and trigger your .min(2) error.
// The .email() method is a built-in convenience function in Zod that acts as a strict format checker.
// Behind the scenes, it is simply running a Regular Expression (Regex) test against the string.
// Zod only checks the syntax (the spelling/format). It does not check if the email actually exists in the real world.

const loginSchema = z.object({
  body: z.object({
    email: z
      .string({required_error: "Email is required"})
      .trim()
      .min(1, "Email is required")
      .email("Invalid email address"),
    // .min(1, "Email is required") Catches empty string: { "email": "" }

    password: z.string().min(6, "Password must be 6 characters long"),
  }),
});

const deleteUserSchema = z.object({
  // We explicitly tell Zod to look at req.params!
  params: z.object({
    // A MongoDB ObjectId is exactly 24 hex characters
    id: z.string().length(24, "Invalid MongoDB ID format"),
  }),
});

const getAllUsersSchema = z.object({
  query: z.object({
    // Coerce converts the string "2" to the number 2, then checks if it's >= 1
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
  }),
});

export {registerSchema, loginSchema, deleteUserSchema, getAllUsersSchema};
