// By extending the built-in Error class, we keep all the native V8 stack trace physics, but we add our own custom properties (like statusCode).

class AppError extends Error {
  constructor(message, statusCode) {
    // 1. Call the parent class (Error) constructor with the message
    super(message);

    // 2. Attach the HTTP Status Code to the object in RAM
    this.statusCode = statusCode;

    // 3. Status Code Logic:
    // If the code starts with '4' (400, 401, 404), it's a 'fail' (User's fault).
    // Otherwise, it's an 'error' (Server's fault).

    // this.status = `${statusCode}`.startsWith("4") ? "FAIL" : "INTERNAL ERROR";
    this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error"; // mathematical boundary is better

    // Flags this as a trusted, known error rather than a programming bug
    this.isOperational = true;

    // 4. Preserve the Stack Trace!
    // This tells the V8 engine: "Do not include this AppError class in the stack trace log. Point directly to the file where the error was THROWN."
    Error.captureStackTrace(this, this.constructor);

    // 1. Argument One (this): The Target
    // You are telling the V8 engine: "Take the current Call Stack and attach it to this specific object in memory."

    // 2. Argument Two (this.constructor): The Filter (The Magic)
    // This is the most critical part. It acts as a physical cutoff point for the log.
    // If you do NOT use this filter, your stack trace will look like this:

    // Error: Invalid credentials
    //   at new AppError (src/utils/AppError.js:15:5)  <-- THE USELESS LINE
    //   at loginUser (src/controllers/userController.js:20:11)
    //   at Layer.handle (node_modules/express/lib/router/layer.js:95:5)

    // By passing `this.constructor` as the second argument, you are telling the V8 engine: "Delete the AppError function from the top of the log. Start the log at the exact file where the error was actually thrown."
  }

  // Override toJSON in AppError
  // When you call res.json({ error: err }), Express uses JSON.stringify() under the hood to convert the object to text.

  // In JavaScript, the built-in Error properties (like message, name, and stack) are created as non-enumerable. This means they are completely invisible to JSON.stringify().
  // Because you added statusCode and isOperational yourself, they are enumerable, so they are the only things that show up in the output.

  toJSON() {
    return {
      statusCode: this.statusCode,
      status: this.status,
      isOperational: this.isOperational,
      message: this.message,
      stack: this.stack,
    };
  }

  // `toJSON()` method is a way to control how your error object is serialized into JSON when you send it in a response.

  // 🔎 Why toJSON() Matters
  // By default, JSON.stringify(err) only includes enumerable properties.
  // Properties like `message` and `stack` on Error are non-enumerable, so they don’t show up.
  // If you override `toJSON()`, you decide exactly what fields should appear when the object is converted to JSON.

  // When you call `res.json(err)` or `JSON.stringify(err)`, Express will internally call err.toJSON() if it exists.
  // That means instead of the default stripped-down object, you’ll get the full structured data you defined.
}

export default AppError;

// Why isOperational is critical
// In a production backend, there are two types of errors:

// Operational Errors: Predictable things you know can go wrong (e.g., user sends a bad Zod payload, a MongoDB document isn't found, an invalid JWT). You handle these intentionally using new AppError().

// Programming Bugs: Unexpected crashes (e.g., TypeError, ReferenceError, a third-party package breaking).

// By adding this.isOperational = true to your custom class, your global Express error-handling middleware can easily tell the difference:
