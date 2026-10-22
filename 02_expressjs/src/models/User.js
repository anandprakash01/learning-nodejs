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
    // learn
    // "date": "2026-06-15T18:30:00.000Z" Notice the Z at the end? That means UTC Time. Always store dates in UTC in your database. Let the frontend worry about converting it to the user's local timezone (like IST).
    date: {
      type: Date,
      required: [true, "Event date and time are required"],
      validate: {
        validator: value => value > Date.now(),
        message: "Event date can not be in past",
      },
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
  // The Salt String (29 Characters)

  const salt = await bcrypt.genSalt(10);

  // Grind the plain text password with the salt, and overwrite the RAM value.
  // The Final Database Hashed Password (60 Characters)
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
  // The bcrypt.compare function expects the un-hashed plain text password first, and the hashed database password second.
};

// => 2. Compile the Blueprint into an Executable Model
// The first argument 'User' is the name. MongoDB will automatically lowercase and pluralize this to create a collection named 'users'.

const User = mongoose.model("User", userSchema);

export default User;

// What salt is : const salt = await bcrypt.genSalt(10)
// Salt: a completely random, cryptographically secure string of text.
// The cost factor in bcrypt is logarithmic. The number 10 does not mean it hashes the password 10 times. It means it hashes it $2^{10}$ times (which is 1,024 iterations).If you increase that argument to 12, the engine will run $2^{12}$ times (4,096 iterations). Adding just +1 to that argument literally doubles the amount of work your CPU has to do.

// If you were to console.log(salt) right after that line runs, you would see an output that looks something like this:
// $2b$10$wI8xE5V/.z3G.F1lJ6h.1u

// The Anatomy of a Bcrypt Salt
// Even though it looks like random gibberish, that string is highly structured.

// $2b$ (The Algorithm): This tells the system exactly which version of the bcrypt algorithm was used to generate it.
// 10$ (The Cost Factor): This is the exact argument 10 you just passed in. Bcrypt permanently records the cost factor inside the salt string so that when the user logs in months from now, the server knows exactly how many CPU cycles it needs to use to verify the password.
// wI8xE5V/.z3G.F1lJ6h.1u (The Raw Salt): This is 22 characters of pure, mathematically random data.

// Why Bcrypt Does This (The Security Aspect)
// If you do not use a salt, and two different users in your database both use the exact same password (e.g., "securepassword123"), their final database hashes will be identical. If a hacker cracks one, they crack both.
// By generating a unique, random salt for every single user, you combine that random string with their password before the heavy computation happens.

// The entire purpose of generating this random string is to defend against Rainbow Table Attacks (hackers using massive, pre-computed lists of common passwords and their resulting hashes).

// Modern hackers do not crack passwords by guessing them one by one; they use massive GPU rigs that can calculate billions of hashes per second to brute-force a database.

// By forcing bcrypt to loop 1,024 times, you are intentionally slowing down the algorithm. A slight delay of 100 milliseconds is completely unnoticeable to a real user logging into your app, but it is mathematically devastating to a hacker trying to run 10 million passwords a second.

// In an enterprise environment, you have to balance security with server performance. Because Node.js is single-threaded, generating these hashes is a CPU-intensive synchronous-like task (even when using await).

// 10 (Standard): The industry default. Fast enough to not bottleneck your Node.js workers, but secure enough to deter casual brute-force attacks.

// 12 (Highly Secure): Recommended for systems handling highly sensitive data. It takes longer to compute but provides massive defense against modern GPUs.

// 14+ (Overkill): Unless you are building banking software, setting this too high will cause your API to freeze up for a full second or more every time a user registers or logs in, potentially crashing your server under high traffic.
