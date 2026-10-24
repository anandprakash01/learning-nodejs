# The Middleware Pipeline

## 🏭 The Express Assembly Line

If routing is the switchboard of Express, **Middleware** is the assembly line.

In Express, a request doesn't just hit a route and immediately stop. It passes through a sequence of functions (the pipeline) before the final response is sent. Every function in this pipeline is a middleware function.

A middleware function has access to three things:

1. The **Request object (`req`)**

2. The **Response object (`res`)**

3. The **`next()` function**

## 1. The `next()` Function (The Conveyor Belt)

When a request enters a middleware function, the function can do one of two things:

1. End the request by sending a response (e.g., `res.send()`).

2. Pass the request to the _next_ function in the pipeline by calling `next()`.

**🚨 CRITICAL RULE:** If a middleware function does not send a response and does not call `next()`, the V8 engine will leave the request hanging in memory indefinitely until the browser eventually times out.

```js
import express from "express";
const app = express();

// A simple custom middleware function
const customLogger = (req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);

  // Pass control to the next function in the line
  next();
};
```

## 2. Global Middleware (`app.use`)

Global middleware executes on **every single incoming request**, regardless of the URL or HTTP verb. You apply global middleware using `app.use()`.

### The Body Parser (`express.json()`)

Out of the box, Node.js and Express do not know how to read JSON payloads sent in a `POST` or `PUT` request. If you try to `console.log(req.body)`, it will return `undefined`.

To fix this, you must mount Express's built-in JSON parser as a global middleware at the very top of your application.

```js
// 1. Global Middleware: Parses incoming JSON strings into JS Objects
app.use(express.json());

// 2. Global Middleware: Custom Logger
app.use(customLogger);

// Now, req.body will correctly contain the parsed object
app.post("/api/users", (req, res) => {
  console.log(req.body);
  res.json({message: "Data received!"});
});
```

_Engine Mechanic:_ Under the hood, `express.json()` listens to the raw data stream coming from the C++ network socket, concatenates the binary buffers, runs `JSON.parse()`, attaches the result to `req.body`, and finally calls `next()`.

## 3. Route-Specific Middleware

Sometimes, you only want middleware to run on specific endpoints. For example, you only want to verify an Admin JWT on administrative routes, not on the public login page.

You can inject middleware directly into the route definition before the final controller function.

```js
// A route-specific middleware function
const requireAdmin = (req, res, next) => {
  const isAdmin = req.headers["x-admin-token"] === "secret123";

  if (isAdmin) {
    next(); // You pass the check, continue to the route
  } else {
    // You failed the check, the pipeline stops here.
    res.status(403).json({error: "Access denied."});
  }
};

// Injecting the middleware into a specific route
app.delete("/api/users/:id", requireAdmin, (req, res) => {
  res.json({message: "User deleted by Admin."});
});

// The public route is unaffected and has no middleware checks
app.get("/api/users", (req, res) => {
  res.json({message: "Public user list."});
});
```

_(You can also chain multiple middlewares by passing an array: `app.post('/api/data', [checkAuth, validateInput], controller)`)._

## 4. The Physics of Execution Order

**Order matters absolutely.** Express executes middleware from top to bottom, exactly as it is written in your file.

If you put a route _before_ your global `express.json()` middleware, that specific route will not be able to read the JSON body, because the request hits the route, the route sends the response, and the pipeline terminates before it ever reaches the parser!

### The Perfect Pipeline Architecture

A standard enterprise `server.js` file is structured in this exact physical order:

1. **Security & Config Middleware:** `cors()`, `helmet()`, `rateLimiter`

2. **Body Parsers:** `express.json()`, `cookieParser()`, `express.urlencoded()`

3. **Custom Global Middleware:** Logging, tracking

4. **The Router Switchboard:** `app.use('/api', routes)`

5. **404 Fallback:** A middleware at the bottom to catch unmatched routes.

6. **Global Error Handler:** The absolute last middleware in the file. (We will cover this in Module 5).
