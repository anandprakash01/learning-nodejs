// This is NOT a standard middleware.
// (err, req, res, next) It has FOUR parameters.

// V8 Physics Trick: Express looks specifically at the `length` property of the function. If it has exactly 4 arguments, Express flags it as an "Error Catcher".
// It will completely ignore this file UNLESS another file explicitly triggers an error using `next(error)`.

// If you write (req, res, next), Express puts it in the "Normal" pipeline. If you write (err, req, res, next), Express physically moves it to a completely different memory array called the "Error" pipeline. When next(err) is called, Express completely skips the Normal pipeline and jumps straight to the Error pipeline.

// What if nothing calls next(err) in Express 5?
// If a developer forgets to use try/catch or next(err) in Express 4, the error vanishes into the void, and the user's browser spins forever.
// Express 5 fixed this. The Express 5 engine wraps every single controller in a hidden V8 Promise. If your controller throws an error, Express 5's internal engine physically catches the explosion and automatically calls next(err) on your behalf. You cannot accidentally hang the server anymore.
import env from "../../config/env.js";

const globalErrorHandler = (err, req, res, next) => {
  console.error(`🚨 [CRASH CAUGHT]: ${err.message}`);
  console.error(err.stack);

  let customError = {
    status: err.status, // "fail" or "error"
    statusCode: err.statusCode || 500,
    message: err.message || "Internal Server Error",
  };

  // ========== DB errors
  // 🚨 THE TRANSLATOR: Catch MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    customError.statusCode = 400; // 400 means "Bad Request from User"
    // We extract the exact field that caused the error (e.g., 'email')
    const field = Object.keys(err.keyValue)[0];
    customError.message = `That ${field} is already in use. Please use another one.`;
  }

  // 🚨 THE TRANSLATOR: Catch Mongoose Cast Errors (Type Mismatches)
  // This triggers if a user sends an Object when a String was expected, or if they send a broken database ID string.
  if (err.name === "CastError") {
    customError.statusCode = 400;
    customError.message = `Invalid data format provided for field: ${err.path}`;
  }

  if (err.name === "ValidationError") {
    // 1. Extract all the individual error messages from the Mongoose object
    const errorMessages = Object.values(err.errors).map(val => val.message);

    // 2. Format them into a single string
    customError.statusCode = 400; // Bad Request
    customError.message = `Invalid input data: ${errorMessages.join(". ")}`;
  }

  // ========== JWT errors
  // 🚨 THE TRANSLATOR: Catch Tampered Tokens
  if (err.name === "JsonWebTokenError") {
    customError.statusCode = 401;
    customError.message = "Invalid token. Please log in again.";
  }

  // 🚨 THE TRANSLATOR: Catch Expired Tokens
  if (err.name === "TokenExpiredError") {
    customError.statusCode = 401;
    customError.message = "Your token has expired. Please log in again.";
  }
  if (err.name === "NotBeforeError") {
    customError.statusCode = 401;
    customError.message = "This token is not active yet. Please wait.";
  }

  res.status(customError.statusCode).json({
    success: false,
    message: customError.message,
    // In production, we NEVER send the stack trace to the client (security risk)
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export {globalErrorHandler};

// JWT actually emits exactly three.

// => TokenExpiredError: The expiration time (exp) has passed.

// => JsonWebTokenError: The token is malformed, the signature is broken, or a hacker tampered with the payload.

// => NotBeforeError (The Rare One): When you create a JWT, you can optionally add a nbf (Not Before) time. If you set nbf to tomorrow, and the user tries to use the token today, the math mathematically rejects it and throws this error.
