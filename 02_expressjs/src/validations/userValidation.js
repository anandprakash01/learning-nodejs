import {z} from "zod";

// mongoDB id Validation
const zMongoId = z
  .string({
    required_error: "Organization assignment is required.",
  })
  // Rule 1: A MongoDB ID is strictly 24 characters long
  .length(24, "MongoDB ID must be exactly 24 characters.")

  // Rule 2: It can only contain hexadecimal characters (0-9, a-f)
  .refine(
    val => {
      const validHexChars = "0123456789abcdefABCDEF";

      // Check every single character in the string
      for (let char of val) {
        if (!validHexChars.includes(char)) {
          return false; // Fails validation instantly if a bad character is found
        }
      }

      return true; // Passes if all 24 characters are valid hex
    },
    {
      message: "Invalid ID format. Must contain only valid hexadecimal characters.",
    },
  );

// Another way
const zMongoId2 = z
  .string({
    required_error: "ID is required.",
  })
  .refine(val => mongoose.Types.ObjectId.isValid(val), {
    message: "Must be a valid MongoDB ObjectId.",
  });

const registerSchema = z.object({
  body: z.object({
    name: z
      // .string({required_error: "Name is required"}) // deprecated in Zod V4
      .string({error: iss => (!iss.input ? "Name is required" : "Invalid input")})
      .min(5, "Name must be at least 5 characters"),

    email: z
      .string({required_error: "Email is required"})
      .trim() // MUST come after .string()
      .min(1, "Email is required") // .min(1) Catches empty string: { "email": "" }
      // .email("Invalid email address")
      // Pipe the cleaned-up string into the top-level Zod 4 email validator
      .pipe(z.email("Please provide a valid email address")),

    password: z.string().min(8, "Password must be 8 characters long"),
    role: z.enum(["user", "architect", "admin"]).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z
      .string({required_error: "Email is required"})
      .trim()
      .min(1, "Email is required") //Catches empty string: { "email": "" }
      .email("Invalid email address"),

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
