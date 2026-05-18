// This is a standard middleware. It intercepts the `req` object to read the Method (GET/POST) and the URL.

// `next()` execution at the bottom. This acts like a gate opening. It tells Express: "I am done looking at this request, pass it to the next middleware or router."

const requestLogger = (req, res, next) => {
  const method = req.method;
  const url = req.url;
  const time = new Date().toLocaleString();

  console.log(`[TRAFFIC] ${time} - ${method} method, ${url}`);

  // Pull the trigger to pass the baton
  next();
};

export {requestLogger};

// // const winston = require("winston");
// const {createLogger, format, transports} = require("winston");

// // const transports = [new winston.transports.Console()]; // all the logs that logger will write, will be in console

// const transportsArray = [
//   new transports.Console(),
//   new transports.File({
//     direname: __dirname, //current directory/folder
//     filename: "user.log",
//   }),
// ]; //this will log, in console and file

// const logger = createLogger({
//   level: "info", // type of log
//   //   format: winston.format.json(),
//   format: format.json(),
//   transports: transportsArray,
// });

// //check loginUser inside userControllers for the usages(Used there)

// module.exports = logger;
