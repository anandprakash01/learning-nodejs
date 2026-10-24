# Error Handling Architecture

## 🚨 Catching Asynchronous Errors and Global Handling

If an application crashes every time a user sends bad data, it is not production-ready. Error handling in Express is about intercepting exceptions before they crash the Node.js process and returning formatted, predictable responses to the frontend.

---

## 1. The Global Error Handler

Express has a very specific mechanism for catching errors. If you define a middleware function with **exactly four parameters** (`err, req, res, next`), Express recognizes it as an Error-Handling Middleware.

It must be placed at the very end of your pipeline, after all your routes.

### ⚙️ The Engine Mechanic

```javascript
// server.js
import express from "express";
const app = express();

// ... all your routes go here

// 1. Catch 404s (Route Not Found)
app.all("*", (req, res, next) => {
  const error = new Error(`Can't find ${req.originalUrl} on this server!`);
  error.status = 404;
  next(error); // Passing an argument to next() triggers the Global Error Handler
});

// 2. The Global Error Handling Middleware (MUST have 4 arguments)
app.use((err, req, res, next) => {
  const statusCode = err.code || err.status || 500;

  // Format a predictable JSON response for the frontend
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined, // Hide stack trace in production
  });
});
```

---

## 2. The Challenge of Asynchronous Code

Express was built in the early days of Node.js before `async/await` existed (it relied entirely on callbacks). Because of this legacy architecture, Express does not automatically catch errors inside asynchronous functions.

If an asynchronous database query throws an error, and you don't explicitly catch it, the error "escapes" the Express pipeline and crashes the V8 engine (an `Unhandled Promise Rejection`).

---

## 3. Express 4 (and below): The `try/catch` Burden

In Express 4, you must wrap **every single async route** in a `try/catch` block. When an error occurs, you must manually pass it to the `next()` function to send it to the Global Error Handler.

### The Problem (Ugly Monoliths)

```javascript
// Express 4: Manual Error Catching
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new Error("User not found");
    }
    res.json(user);
  } catch (error) {
    next(error); // Manual pass to the error pipeline
  }
});
```

### The Solution (`express-async-handler`)

To avoid writing `try/catch` in every single controller function, developers use a wrapper function (like `express-async-handler`). It catches the rejected promise automatically and calls `next(err)`.

```javascript
import asyncHandler from "express-async-handler";

// Express 4: Clean approach using a wrapper
app.get(
  "/users/:id",
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      // The wrapper catches this automatically and forwards to next()
      throw new Error("User not found");
    }
    res.json(user);
  }),
);

// asyncHandler.js
// custom async handler function to catch the error
const asyncHandler = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

---

## 4. Express 5: The Modern Architecture

Express 5 completely modernized the engine. The framework now natively understands Promises.

If a route returns a rejected promise, **Express 5 automatically catches it and forwards it to the Global Error Handler.** You no longer need `try/catch` blocks or asyncHandler wrapper for standard route errors.

```javascript
// Express 5 Architecture
app.get("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    // Express 5 catches this implicitly and routes it to your (err, req, res, next) middleware!
    throw new Error("User not found");
  }

  res.json(user);
});
```

---

## 5. Custom Application Errors (The `AppError` Class)

Instead of using the generic JavaScript `Error` object, enterprise systems extend it to include HTTP status codes and operational flags.

```javascript
// utils/AppError.js
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;

    // Distinguish between anticipated errors (e.g., bad user input) and unpredictable programming bugs.
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
```

**Usage in a Controller (Express 5):**

```javascript
import AppError from "../utils/AppError.js";

export const getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    // Much cleaner! Sets the message and the 404 status instantly.
    throw new AppError(404, "User not found in the system");
  }
  res.json(user);
};
```
