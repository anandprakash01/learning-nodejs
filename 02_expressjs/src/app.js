import express from "express";
import cookieParser from "cookie-parser";

// Network Shields and data sanitization
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
// import ExpressMongoSanitize from "express-mongo-sanitize";

// Under the strict rules of Node ESM, you must type the exact physical file path, including the .js extension. If you forget the .js, the server will crash instantly.
import env from "../config/env.js";
import {requestLogger} from "./middlewares/logger.js";
import {globalErrorHandler} from "./middlewares/errorHandler.js";

import userRoutes from "./routes/userRoutes.js";
import reviewRoutes from "./routes/ReviewRoutes.js";

const app = express();

// The Rule of Sequence: In Express, order is literally everything. The pipeline executes top-to-bottom.

// The Logger must be at the very top (so it catches everything).
// The Error Handler must be at the very bottom (so it acts as a safety net if any routes above it explode).

/* ========================================================
   1. THE BROWSER GATEWAY
======================================================== */
// Implement CORS.
// In development, you can leave it empty to allow all.
// In production, you strictly lock it to your frontend domain!

// app.use(cors()); //cross origin resource sharing
const corsOptionObj = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
};
// app.use(cors(corsOptionObj));

const whitelist = [
  "https://site-a.com",
  "https://site-b.com",
  "http://localhost:3000",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: whitelist,
    credentials: true, // 🚨 REQUIRED if you are sending JWTs in Cookies!
  }),
);

// The Dynamic Function Method (Best for scaling)
const corsOptions = {
  origin: function (origin, callback) {
    // 1. Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) {
      return callback(null, true);
    }

    // 2. Check if the origin is in our whitelist array
    if (whitelist.includes(origin)) {
      callback(null, true); // (error is null, allow is true)
    } else {
      callback(new Error("Not allowed by CORS")); // Reject the request
    }
  },
};

// app.use(cors(corsOptions));

// The "magic" of Express middleware! You wrote the function, but you never actually write the code to call the function.
// this function runs every single time an HTTP request hits your server, before the request is allowed to reach controllers.
// When the request hits your server, the cors library steps in and does this behind the scenes:
// It grabs the Origin header from the incoming request.
// It creates a special callback function.
// It literally executes your function, passing those two things into it.

/* ========================================================
   2. THE NETWORK SHIELDS
======================================================== */
// 1. Set Security HTTP Headers
app.use(helmet());

// 2. Limit Requests from the same IP
const limiter = rateLimit({
  max: 100, // Limit each IP to 100 requests...
  limit: 100,
  windowMs: 60 * 60 * 1000, // ...per 1 hour (in milliseconds)
  message: "Too many requests from this IP, please try again in an hour!", // The 429 message
});

// We apply this limiter ONLY to routes that start with /api
app.use("/api", limiter);

/* ========================================================
   3. THE BODY PARSER
======================================================== */
// The Parser (express.json()): When the text hits your server, the Express JSON middleware intercepts it. It runs JSON.parse(), translates the text into a V8 JavaScript Object, and physically attaches it to req.body.
// This reads the JSON body. We limit it to 10kb so hackers can't send huge files to crash RAM.
app.use(express.json());
app.use(express.json({limit: "10kb"}));

app.use(cookieParser()); // To read cookies from an incoming HTTP request, Express needs special parser.

/* ========================================================
   4. THE DATA PURIFIERS (They MUST come AFTER express.json!
======================================================== */
// A. Data sanitization against NoSQL query injection
// Looks at req.body, req.query, and req.params, and rips out $ and .

// app.use(mongoSanitize());

// In JavaScript, a "getter" is a property that is read-only. It calculates its value on the fly when you ask for it, but you are not allowed to overwrite it using an equals sign (=).

// The Express 5 Change: In Express version 5, the creators changed how the URL query string (req.query) works under the hood. They made it a "getter" to improve performance.

// The Sanitize Package's Mistake: The express-mongo-sanitize package is older. When it runs, it cleans your data and then literally tries to overwrite the original object like this: req.query = cleanedQuery.

// The Crash: Because Express 5 says req.query is strictly read-only, Node.js panics and throws the exact error you are seeing: "Cannot set property query... which has only a getter."

// Custom sanitizer middleware
app.use((req, res, next) => {
  // We manually sanitize the body and params, but skip the query
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);

  next();
});

// B. Data sanitization against XSS
// Cleans any user input from malicious HTML code
// app.use(xss());
// the industry has largely moved away from using this specific approach in recent years.

/* ========================================================
   5. ROUTERS & ERROR HANDLERS
======================================================== */
app.use(requestLogger);

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/reviews", reviewRoutes);

//The 404 Route
app.use((req, res) => {
  res.status(404);

  // // respond with html page
  // if (req.accepts("html")) {
  //   res.render("404", {url: req.url});
  //   return;
  // }

  // default to plain-text. send()
  // res.type("txt").send("Not found");

  res.status(404).json({
    success: false,
    data: {
      message: "Error 404, Not found",
    },
  });
});

// A deliberate test route to trigger a crash
app.get("/api/crash", async (req, res, next) => {
  // const g = req.data.anand; // the error, Synchronous code

  // The Asynchronous Crash (The Fatal Flaw)
  const databaseTask = new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("MongoDB violently crashed!"));
    }, 2000);
  });

  await databaseTask;

  const fakeError = new Error("The database violently exploded!");
  fakeError.statusCode = 503;
  // By passing the error into next(), we skip all other routes and teleport directly to the globalErrorHandler at the bottom.
  // next(fakeError);

  res.status(200).json({
    message: "Response",
  });
});

// For the last 10 years, the creators of Express knew that the "Promise Blindness" was the biggest flaw in their framework. When they finally released Express 5.0, their number one priority was fixing it.
// In Express 5, they re-wrote the internal C++ router to natively understand the async keyword. Now, if an asynchronous Promise rejects in the background, Express 5 automatically catches it and presses the next(error) trigger for you.
// It is doing the exact same job as the asyncHandler, but it does it natively at the engine level. Adding your own asyncHandler on top of Express 5 is redundant and adds unnecessary V8 function calls.
// the creators of Express secretly wrapped the execution of controller in a hidden try/catch block.
// Because the code is synchronous, it explodes while Express was still watching. The internal Express try/catch immediately caught the TypeError or whatever, and Express automatically fires next(err) for you in the background. That is why it hits globalErrorHandler.

// Synchronous Code (No Promises): Express can catch explosions automatically because they happen instantly.
// Asynchronous Code (Promises/Databases): Express is blind (express 4.0). You MUST use asyncHandler to force Express to catch the explosion in the future.

app.use(globalErrorHandler);

export default app;
