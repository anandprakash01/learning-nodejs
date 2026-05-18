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
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    // 4. Preserve the Stack Trace!
    // This tells the V8 engine: "Do not include this AppError class in the
    // stack trace log. Point directly to the file where the error was THROWN."
    Error.captureStackTrace(this, this.constructor);

    // 1. Argument One (this): The Target
    // You are telling the V8 engine: "Take the current Call Stack and attach it to this specific object in memory."

    // 2. Argument Two (this.constructor): The Filter (The Magic)
    // This is the most critical part. It acts as a physical cutoff point for the log.
    //     If you do NOT use this filter, your stack trace will look like this:

    // Error: Invalid credentials
    //   at new AppError (src/utils/AppError.js:15:5)  <-- THE USELESS LINE
    //   at loginUser (src/controllers/userController.js:20:11)
    //   at Layer.handle (node_modules/express/lib/router/layer.js:95:5)

    // By passing `this.constructor` as the second argument, you are telling the V8 engine: "Delete the AppError function from the top of the log. Start the log at the exact file where the error was actually thrown."
  }
}

export default AppError;
