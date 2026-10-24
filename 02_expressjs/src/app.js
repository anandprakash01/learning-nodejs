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
import env from "./config/env.js";
import {requestLogger} from "./middlewares/logger.js";
import {globalErrorHandler} from "./middlewares/errorHandler.js";

import userRoutes from "./routes/userRoutes.js";
import reviewRoutes from "./routes/ReviewRoutes.js";

const app = express();

// The "app" object is the beating heart of an Express.js application. Technically, it is a Node.js routing and middleware web framework instance. When you call const app = express(), you are creating a central registry that holds all your application's settings, routes, and middleware functions, and determines exactly how incoming HTTP requests should be handled.

// app.use([path], middleware): This mounts a middleware function. A middleware is simply a function that intercepts an incoming request before it reaches your final route. If you don't specify a path (e.g., app.use(cors())), it runs on every single incoming request.

// app.set(name, value): This assigns application-level configuration settings. You use it to define underlying server behaviors, such as app.set('trust proxy', 1) to tell Express it is sitting behind a cloud load balancer (like Render), or to configure a template engine.

// app.get(), app.post(), app.put(), app.delete(): These are routing methods. They tell the app to listen for specific HTTP verbs on specific URL paths and execute a controller function when a match is found.

// app.listen(port): This binds the app to a specific network port on your machine and starts actively listening for incoming TCP connections.

// The Rule of Sequence: In Express, order is literally everything. The pipeline executes top-to-bottom.

// The Logger must be at the very top (so it catches everything).
// The Error Handler must be at the very bottom (so it acts as a safety net if any routes above it explode).

/* ========================================================
   1. THE BROWSER GATEWAY
======================================================== */

// Setting app.set("trust proxy", 1) tells Express exactly how many reverse proxies (like Render, AWS, or Cloudflare) sit between your server and the actual user.
// Added this line so Express trusts Render's proxy
app.set("trust proxy", 1);
// Express thinks the direct connection (Render's load balancer) is the user. Everyone shares the same IP, which breaks rate limiters.
// With "trust proxy", 1: Express knows there is exactly 1 proxy in front of it. It reads the X-Forwarded-For header provided by Render and correctly assigns req.ip to the actual user's IP address.

// Implement CORS.
// CORS (Cross-Origin Resource Sharing) is a security mechanism enforced by the web browser, not the backend.
// Browsers have a strict security rule called the "Same-Origin Policy". If a user is on `http://localhost:5173` (your React frontend) and the JavaScript tries to fetch data from `http://localhost:3000` (your Node API), the browser immediately blocks the response. It does this to prevent malicious websites from making silent API calls to your bank or email provider using saved session cookies.
// CORS must be used whenever frontend and backend live on different domains, different subdomains, or different ports. The cors() middleware acts as a bouncer for your API. It automatically attaches specific HTTP headers to your backend responses that tell the browser, "It's safe, I explicitly allow localhost:5173 to read my data."

// When you configure `app.use(cors({ ...options }))`, you are fine-tuning exactly who gets past the bouncer and what they are allowed to do.

// ========== {origin: 'http://localhost:5173'} or {origin: true}
// It Controls who can access the API.
// limits access to just your local frontend. For production, you use your deployed frontend URL. If you set it to origin: '*' (or leave it blank), any website on the internet can hit your API.

// When you set origin: true, the CORS middleware looks at the incoming request, reads the Origin header (the website making the API call), and dynamically echoes that exact same URL back in the Access-Control-Allow-Origin response header.
// If `http://localhost:5173` calls the API, the server responds: "I allow `http://localhost:5173`"

// You use `origin: true` when you want to allow any website to access your API, AND you also need to accept cookies or authorization headers (credentials: true).
// Browsers have a strict security rule: if {credentials: true} is enabled, you are not allowed to use origin: '*'. You must specify an exact URL. origin: true acts as a shortcut to bypass this restriction by dynamically printing whatever URL just knocked on the door.

// You aren't limited to just strings, arrays, or booleans for the origin. You can also pass a callback function. This is heavily used in SaaS platforms where users can add their own custom domains to their profile. The function allows you to query your MongoDB database in real-time to check if the incoming domain belongs to a paying customer before allowing the request.

// ========== {methods: ['GET', 'POST', 'PUT', 'DELETE']}
// It Dictates which HTTP verbs are allowed from the origin.
// If a frontend tries to send a PATCH request and it isn't in this list, the browser will block it.

// ========== {credentials: true} or {credentials: env.NODE_ENV === "production"}
// This Determines if the frontend is allowed to send sensitive data like cookies, authorization headers (JWTs), or TLS client certificates.
// If your frontend uses axios.defaults.withCredentials = true to send a login cookie, your backend CORS config must have this set to true, and your origin cannot be a wildcard (*).

// ========== {optionsSuccessStatus: 200}
// For complex requests (like sending JSON or using PUT/DELETE), the browser sends an invisible "Preflight" request using the OPTIONS method to ask the server for permission before sending the real request. By default, Express CORS responds to this with a 204 No Content status.
// Some legacy browsers (like old Smart TVs or Internet Explorer 11) choke on a 204 status. Setting this to 200 ensures maximum compatibility across all older devices.

// ========== {allowedHeaders: ['Content-Type', 'Authorization', 'x-custom-header']}
// Controls which custom HTTP headers the frontend is allowed to send to your server.
// If your frontend tries to send a custom header (like x-api-key or Authorization: Bearer <token>), the browser will block the request unless the server explicitly whitelists that header.

// In development, you can leave it empty to allow all.
// In production, you strictly lock it to your frontend domain!

// app.use(cors());

const whitelist = [
  "https://site-a.com",
  "https://site-b.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

const corsOptions1 = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
};

const corsOptions2 = {
  origin: whitelist,
  credentials: true, // 🚨 REQUIRED if you are sending JWTs in Cookies!
};

// The Dynamic Function Method (Best for scaling)
const corsOptions3 = {
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

// app.use(cors(corsOptions1));
app.use(cors(corsOptions2));
// app.use(cors(corsOptions3));

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
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the deprecated `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again in an hour!", // The 429 message
});
// max - This was the original name for the property in older versions of the package (v5 and below)
// limit - In newer versions of the package (v6 and v7+), the developers renamed the property to limit

// We apply this limiter ONLY to routes that start with /api
app.use("/api", limiter);

/* ========================================================
   3. THE BODY PARSER
======================================================== */
// The Parser (express.json()): When the text hits your server, the Express JSON middleware intercepts it. It runs JSON.parse(), translates the text into a V8 JavaScript Object, and physically attaches it to req.body.
// This reads the JSON body. We limit it to 10kb so hackers can't send huge files to crash RAM.
app.use(express.json());
app.use(express.json({limit: "10kb"})); // listens only for content-type : `application/json`
// When a user uploads a file, the frontend must change the content type to multipart/form-data. When express.json() sees this, it says, "This isn't JSON," and completely ignores the request. The 10kb limit is bypassed.

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

app.use(globalErrorHandler);

export default app;

/*
For the last 10 years, the creators of Express knew that the "Promise Blindness" was the biggest flaw in their framework.
"Promise Blindness" refers to the architectural limitation of Express 4
Express 4 was written in 2014, 3 years before the async/await syntax existed in JavaScript. It was designed to wrap your code in a synchronous try/catch block.
When you use an async function, the code does not finish immediately. You send a query to MongoDB and tell Node.js, "I'll wait here for the Promise to resolve." In Express 4, as soon as your code paused to await the database, Express assumed the synchronous part of the function was successful and stopped watching.

If the database crashed 50 milliseconds later, the Promise rejected. But because Express had already stopped watching, it was "blind" to the explosion. It wouldn't catch the error, it wouldn't send a response to the user, and the browser would just sit there spinning indefinitely until the connection timed out.

Synchronous Code (No Promises): Express can catch explosions automatically because they happen instantly.
Asynchronous Code (Promises/Databases): Express is blind (express 4.0). You MUST use asyncHandler to force Express to catch the explosion in the future.

When they finally released Express 5.0, their number one priority was fixing it.
In Express 5, they re-wrote the internal C++ router to natively understand the Promises. Now, if an asynchronous Promise rejects in the background, Express 5 automatically catches it and presses the next(error) trigger for you.
It is doing the exact same job as the asyncHandler, but it does it natively at the engine level. Adding your own asyncHandler on top of Express 5 is redundant and adds unnecessary V8 function calls.

Express 4  or below does not use await when it calls your controller.

Here is a simplified look at exactly what Express 4 is doing under the hood when a request hits your route:

// Inside Express 4's routing engine (Pseudo-code)
try {
  
  // 🚨 Notice there is NO 'await' keyword here!
  yourController(req, res, next); 
  
} catch (err) {
  next(err);
}

How Express 5 fixed this
The entire reason Express 5 was created was essentially to add the await keyword to that internal engine. In Express 5, the internal router looks more like this:

// Inside Express 5's routing engine
try {
  // Now it actually waits for your Promise to resolve or reject!
  await yourController(req, res, next); 
} catch (err) {
  next(err); // Automatically catches thrown AppErrors!
}
*/
