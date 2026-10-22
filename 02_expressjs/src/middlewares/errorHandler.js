// This is NOT a standard middleware.
// (err, req, res, next) It has FOUR parameters.

// Express knows which function is your global error handler strictly by counting the arguments in your function signature. If it has exactly 4 arguments, Express flags it as an "Error Catcher".

// In JavaScript, every function has a .length property that returns the number of parameters it expects. Express uses this property under the hood to distinguish normal middleware from error-handling middleware.

// The Signature Rule
// Normal Middleware: Has 3 arguments: (req, res, next).
// Error Middleware: Has exactly 4 arguments: (err, req, res, next).

// When a route crashes or you call next(err), Express immediately stops executing normal code and enters "Error Mode." It skips over every normal 3-argument middleware in your pipeline and jumps directly to the first function it finds that has exactly 4 arguments.

// Express will completely ignore this middleware UNLESS another file explicitly triggers an error using `next(error)`.

// If you write (req, res, next), Express puts it in the "Normal" pipeline. If you write (err, req, res, next), Express physically moves it to a completely different memory array called the "Error" pipeline. When next(err) is called, Express completely skips the Normal pipeline and jumps straight to the Error pipeline.

// What if nothing calls next(err) in Express 5?
// If a developer forgets to use try/catch or next(err) in Express 4, the error vanishes into the void, and the user's browser spins forever.
// Express 5 fixed this. The Express 5 engine wraps every single controller in a hidden V8 Promise. If your controller throws an error, Express 5's internal engine physically catches the explosion and automatically calls next(err) on your behalf. You cannot accidentally hang the server anymore.

import env from "../../config/env.js";

const globalErrorHandler = (err, req, res, next) => {
  // let customError = {
  //   status: err.status, // "fail" or "error"
  //   statusCode: err.statusCode || 500,
  //   message: err.message || "Internal Server Error",
  //   isOperational: err.isOperational || false,
  // };

  // better and clean
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let isOperational = err.isOperational || false;

  // ========== DB errors
  // 🚨 THE TRANSLATOR: Catch MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 400; // 400 means "Bad Request from User"
    // We extract the exact field that caused the error (e.g., 'email')
    const field = Object.keys(err.keyValue)[0];
    message = `That ${field} is already in use. Please use another one.`;
    isOperational = true;
  }

  // 🚨 THE TRANSLATOR: Catch Mongoose Cast Errors (Type Mismatches)
  // This triggers if a user sends an Object when a String was expected, or if they send a broken database ID string.
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid data format provided for field: ${err.path}`;
    isOperational = true;
  }

  if (err.name === "ValidationError") {
    // 1. Extract all the individual error messages from the Mongoose object
    const errorMessages = Object.values(err.errors).map(val => val.message);

    // 2. Format them into a single string
    statusCode = 400; // Bad Request
    message = `Invalid input data: ${errorMessages.join(". ")}`;
    isOperational = true;
  }

  // ========== JWT errors
  // 🚨 THE TRANSLATOR: Catch Tampered Tokens
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
    isOperational = true;
  }

  // 🚨 THE TRANSLATOR: Catch Expired Tokens
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your token has expired. Please log in again.";
    isOperational = true;
  }
  if (err.name === "NotBeforeError") {
    statusCode = 401;
    message = "This token is not active yet. Please wait.";
    isOperational = true;
  }

  // =========== sending response

  if (env.NODE_ENV !== "production") {
    const logTag = statusCode >= 500 ? "[ERROR]" : "[WARN ]";

    console.error(`${logTag} [EXPRESS] ${message}`);
    console.log(err);

    return res.status(statusCode).json({
      success: false,
      message,
      // In production, we NEVER send the stack trace to the client (security risk)
      stack: err.stack,
      error: err,
      // When you call res.json({ error: err }), Express uses JSON.stringify() under the hood to convert the object to text.

      // In JavaScript, the built-in Error properties (like message, name, and stack) are created as non-enumerable. This means they are completely invisible to JSON.stringify().
      // Because you added statusCode and isOperational yourself, they are enumerable, so they are the only things that show up in the output.
    });
  }

  if (isOperational) {
    return res.status(statusCode).json({
      success: false,
      message: message,
    });
  }

  // In PROD: If it's a programming bug, hide the details from the user
  console.error(`[FATAL] [PROGRAMMING BUG]:`, err);
  res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again later.",
  });
};

export {globalErrorHandler};

/* 
JWT actually emits exactly three.

=> TokenExpiredError: The expiration time (exp) has passed.

=> JsonWebTokenError: The token is malformed, the signature is broken, or a hacker tampered with the payload.

=> NotBeforeError (The Rare One): When you create a JWT, you can optionally add a nbf (Not Before) time. If you set nbf to tomorrow, and the user tries to use the token today, the math mathematically rejects it and throws this error.

Why keep E11000 if you check for duplicates in the controller?
You need the E11000 handler because checking for duplicates in your controller is actually vulnerable to Race Conditions.

Imagine two users (or a double-click on a submit button) send a request to register the exact same email at the exact same millisecond:

Request A asks the database: "Does this email exist?" (DB says No)

Request B asks the database: "Does this email exist?" (DB says No)

Request A tells the DB: "Great, save it!"

Request B tells the DB: "Great, save it!"

If you only rely on your controller, Request B will overwrite or duplicate Request A. But because MongoDB has a strict unique index at the database level, Request B is blocked at the final microsecond, and MongoDB throws the E11000 error.

Industry Tip: Many senior developers actually remove the manual duplicate check from their controllers entirely to save an unnecessary database read. They simply attempt to save the document and let the global E11000 handler catch the duplicate if it happens.
*/
