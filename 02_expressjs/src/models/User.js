import mongoose, {SchemaTypeOptions} from "mongoose";
import {maxLength, minLength} from "zod";
import bcrypt from "bcryptjs";

// => 1. Define the Blueprint
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"], // The second value is the custom error message
      trim: true,
      maxLength: [50, "Name cannot be more than 20 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide a email"],
      unique: true,
      lowercase: true, // (prevents login bugs)

      // 🚨 THE REGEX BOUNDARY
      // This mathematical formula guarantees the string contains text, an '@' symbol, and a domain (like .com)
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address", // CUSTOM MESSAGE
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minLength: [8, "Password must be at least 6 characters long"],
      select: false, // 🚨 ENTERPRISE SECURITY: Never returns this field in standard database queries!
    },
    role: {
      type: String,
      // enum: ["user", "admin", "architect"], // The ONLY three strings allowed to be saved
      enum: {
        values: ["user", "admin", "architect"],
        // {VALUE} is a dynamic Mongoose variable that injects whatever the user typed!
        message: "{VALUE} is not a valid role in this system.",
      },
      default: "user",
    },
    ratingsAverage: {
      type: Number,
      default: 4.5, // Start them with a decent default
      min: [1, "Rating must be above 1.0"],
      max: [5, "Rating must be below 5.0"],
      set: val => Math.round(val * 10) / 10, // Math trick: Rounds 4.6666 to 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    // Account lockout
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    accountLockedUntil: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    // Mongoose will automatically inject `createdAt` and `updatedAt` Date objects into every document right before it crosses the network.

    // Ghost field
    toJSON: {virtuals: true}, // 🚨 TELL V8 TO CONVERT GHOSTS TO JSON
    toObject: {virtuals: true},
    id: false, // 🚨 Kills the default string ghost
  },
);

userSchema.virtual("reviews", {
  ref: "Review", // 1. What Model are we looking for?
  foreignField: "author", // 2. What is the name of the bridge on the OTHER side?
  localField: "_id", // 3. What is the name of the bridge on THIS side?
});
// When you write userSchema.virtual("reviews", ...), you are simply naming a variable.

// If you use an arrow function, the V8 engine binds the this keyword to the entire file. this.password will be undefined, and your app will crash. By using the old-school function keyword, Mongoose forcefully binds this to point exactly at the physical user document sitting in RAM right before it saves.

// userSchema.pre("save", async function (next) {
userSchema.pre("save", async function () {
  // RULE 1: The 'isModified' Protection
  // If the user is just updating their name or email, we DO NOT want to re-hash an already hashed password. That would permanently lock them out.
  if (!this.isModified("password")) {
    // return next(); // Skip the meat grinder, move to the database
    return; // Just return! The Promise resolves, Mongoose automatically moves on.
  }

  // RULE 2: The Hashing Sequence
  // Generate the random Salt (Cost factor 10 means it runs 2^10 times, making it physically slow to protect against brute-force attacks).

  const salt = await bcrypt.genSalt(10);

  // Grind the plain text password with the salt, and overwrite the RAM value.
  this.password = await bcrypt.hash(this.password, salt);

  // next(); // Release the pause, send to the database!
  // No next() at the bottom. When the function ends, the Promise is resolved, and Mongoose instantly fires the BSON to the database.
});

// We could write the password-checking math directly in the controller, but Enterprise Architecture dictates that a Model should be responsible for its own data. We are going to attach a custom function directly to the Mongoose User document.

// We attach a custom method to the Schema.
// Every time we pull a user from the database, they will have this function attached.
userSchema.methods.matchPassword = async function (enteredPass) {
  // bcrypt.compare takes the plain text password, reads the salt embedded inside the stored hash, and runs the meat grinder again to see if they match.
  return await bcrypt.compare(enteredPass, this.password);
  // The bcrypt.compare function expects the unhashed plain text password first, and the hashed database password second.
};

// => 2. Compile the Blueprint into an Executable Model
// The first argument 'User' is the name. MongoDB will automatically lowercase and pluralize this to create a collection named 'users'.

const User = mongoose.model("User", userSchema);

export default User;
