# Cryptography & Password Security

## 🔐 Hashing, Salting, and Bcrypt

If a hacker breaches your database and downloads your `Users` table, what do they see? If they see plain-text passwords (e.g., `password123`), you have committed the ultimate backend engineering sin.

Because users frequently reuse the same password across multiple websites (banking, email, social media), exposing their plain-text password can ruin their digital lives. You must secure passwords before they ever touch your database.

## 1. Encryption vs. Hashing

### Encryption (Two-Way)

Encryption is a two-way (reversible) mathematical process that scrambles readable data (plaintext) into an unreadable format (ciphertext) using a cryptographic key. Its primary purpose is confidentiality—ensuring that only authorized parties who possess the correct decryption key can read the original data.
**_Example Use Case_**: Securing credit card numbers, private messages, or JWTs. The application eventually needs to read the original data.
**_Standard Algorithms_**: AES-256, RSA.

Encryption is a lockbox. You take the string "password123", lock it using a secret Key, and it becomes "xj9!2nL". If you have the Key, you can unlock it and get "password123" back.

- **Rule:** Never encrypt passwords. If a hacker steals your database, they will also steal the server where the Key is stored, and unlock every password.

### Hashing (One-Way)

Hashing is a one-way (irreversible) mathematical process that converts data of any size into a fixed-length string of characters (a hash or digest). Its primary purpose is integrity and verification—proving that data has not been altered, without actually revealing the data itself. A hash cannot be "decrypted" back into the original text.

**_Example Use Case_**: Storing user passwords. The server hashes the password during signup. When the user logs in, the server hashes the entered password and compares the two hashes, never knowing the actual password.

**_Standard Algorithms_**: bcrypt, Argon2, SHA-256.

- **The Physics:** It is mathematically impossible to reverse this process. Even if you have the world's most powerful supercomputer, you cannot put the password back.

_So how do we log the user in?_
When the user tries to log in tomorrow, they type "password123" again. We put that attempt through the exact same meat grinder. If the resulting 60-character hash perfectly matches the hash stored in the database, we know they typed the correct password. We never need to know what the original password actually was.

## 2. The Threat: Rainbow Tables

Early backend systems used simple, fast hashing algorithms like MD5 or SHA-256.
If a user's password was `apple`, the SHA-256 hash would always be:
`3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b`

**The Vulnerability:** Hackers realized this predictability. Instead of trying to crack the hash, they built massive databases called **Rainbow Tables**. These tables contain billions of common passwords and their pre-computed hashes. When they steal your database, they simply run a `JOIN` against their Rainbow Table and instantly reveal millions of passwords.

## 3. The Solution: Salting and Key Stretching

To defeat Rainbow Tables, modern cryptography introduced two mechanics:

1. **Salting:** Before hashing the password, the engine generates a random string of characters (the "salt") and appends it to the password (`apple + x8fT9z`). This ensures that even if two users have the exact same password, their final hashes will look completely different.
2. **Key Stretching (Rounds):** Algorithms like MD5 are designed to be fast, allowing hackers to guess billions of passwords per second. Modern password algorithms intentionally slow down the CPU. You define the `Cost factor` or `Rounds` to dictate how many milliseconds it takes to generate one hash.

## 4. The Industry Standard: Bcrypt

**Bcrypt** is a specialized password-hashing algorithm that automatically handles salting and key stretching. (Another modern alternative is _Argon2_).

**Note:** We use `bcryptjs` (pure JavaScript) instead of `bcrypt` (C++) because it prevents cross-platform C++ compilation errors when deploying to different server environments like AWS or Vercel.

Bcrypt does not just hash the password. It adds a Salt.
If two users both have the password "password123", a standard hash would produce the exact same scrambled string. A hacker could use a "Rainbow Table" (a giant list of pre-calculated hashes) to figure it out.

Bcrypt solves this by generating a random 10-character string (the "Salt") and injecting it into the password before grinding it. Now, even if a million users use "password123", every single hash in your database will look completely unique.

Here is how you implement Bcrypt seamlessly in a Node.js/Mongoose architecture using Middleware (Hooks).

Install the library:

```bash
npm install bcryptjs
```

### Step 1: Hashing on Registration (Mongoose Pre-Save Hook)

We could hash the password inside the `userController.js` before calling `User.create()` but Enterprise Architecture dictates that a Model should be responsible for its own data.
What if an Admin creates a user from a completely different controller? You would have to remember to write the hashing logic twice.

Instead, we attach it directly to the Blueprint (Schema). We use a Mongoose Document Middleware called `pre('save')`.

This acts as a physical checkpoint:

- `User.create()` is called.
- Mongoose perfectly validates the data against the Schema.
- The `pre('save')` checkpoint activates. We pause the V8 engine, hash the password, and swap out the plain text for the hash.
- The database TCP socket fires.

We intercept the document right before it saves to the database.

```javascript
import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // bcryptjs is optimized for standard Node.js environments

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // 🚨 ENTERPRISE SECURITY: Never return this field in standard database queries!},
    },
  },
  {},
);

// The Pre-Save Hook
userSchema.pre("save", async function (next) {
  // 1. Only hash the password if it has been modified (or is new)
  // If the user is just updating their email, we don't want to re-hash the already hashed password!
  if (!this.isModified("password")) return next();

  try {
    // 2. Generate a salt (Cost Factor of 12 is the current enterprise standard)
    // A factor of 12 means 2^12 (4,096) hashing iterations.
    const salt = await bcrypt.genSalt(12);

    // 3. Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);
export default User;
```

### Step 2: Comparing on Login

When the user attempts to log in, you cannot simply hash their input and use `===` to compare it to the database string, because Bcrypt generates a random salt every time. You must use Bcrypt's native `compare` method.

We can attach this method directly to the Mongoose Schema as an instance method:

```javascript
// Add an instance method to the schema
userSchema.methods.comparePassword = async function (candidatePassword) {
  // this.password is the hashed string stored in the database
  return await bcrypt.compare(candidatePassword, this.password);
};
```

**Usage in your Express Login Controller:**

```javascript
export const loginUser = async (req, res) => {
  const {email, password} = req.body;

  // 1. Find the user
  const user = await User.findOne({email});
  if (!user) {
    return res.status(401).json({error: "Invalid credentials"});
  }

  // 2. Use our custom Mongoose method to check the password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    // ALWAYS use the exact same error message for bad emails or bad passwords
    // to prevent "Email Enumeration" attacks.
    return res.status(401).json({error: "Invalid credentials"});
  }

  res.json({message: "Login successful!"});
};
```
