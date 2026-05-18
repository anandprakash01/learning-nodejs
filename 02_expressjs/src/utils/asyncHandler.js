// This is a Higher-Order Function. It is a function that takes your controller function as an argument (`fn`), and returns a new, fortified function to Express.

// The Physics:
// 1. It executes your controller: `fn(req, res, next)`
// 2. It wraps the execution in `Promise.resolve()` to guarantee it is a Promise.
// 3. If the Promise rejects (an error happens), `.catch()` instantly intercepts it and fires `next(err)`, teleporting the error to your globalErrorHandler.

// Promise.resolve() is a universal V8 transformer. It is an impenetrable mathematical safeguard that guarantees the output is always a Promise.

// If the controller is async: It sees the Promise, leaves it alone, and passes it through.
// If the controller is synchronous: It sees undefined or plain text, and instantly wraps it inside a successful, resolved Promise.

const asyncHandler = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
// The .catch() method is a Higher-Order Function. This means it is designed to accept another function as its argument.
// When a Promise rejects, the internal C++ code of .catch() does two things:
// It grabs the error object.
// It takes whatever function you handed to it, and physically executes it, automatically injecting the error as the first argument.

// ================ Another Handler ================

// The Wrapper is the Funnel. Its only job is to catch the error and push it down the pipe.
// The Global Error Handler (errorHandler.js) is the Net. Its job is to format the response and talk to the user.
// By hardcoding the res.status(500) inside the wrapper, your Global Error Handler is completely bypassed. It will never run again.
// If MongoDB throws a Duplicate Key error, your wrapper overrides it and says "Something went wrong."
// If a user forgets a password, your wrapper overrides it and says "Something went wrong."

// A wrapper must be a dumb tunnel. It should never make decisions. It should never send HTTP responses.

// .catch() is a method that only exists on a Promise object.
// what if a developer wraps a normal, synchronous controller?
// it does not return a Promise. It physically returns undefined.
// When your wrapper tries to execute it, the V8 engine evaluates the line as: undefined.catch(...).

// The engine will instantly panic and throw: TypeError: Cannot read properties of undefined (reading 'catch').
// By trying to protect the server, the below wrapper actually caused a fatal crash.

// const asyncHandler = fn => {
//   return (req, res, next) => {
//     fn(req, res, next).catch(err => {
//       console.log("Error Occurred in Global error Handler, Message:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: "Something went wrong, Please try again",
//       });

//       // next();
//     });
//   };
// };

export {asyncHandler};
