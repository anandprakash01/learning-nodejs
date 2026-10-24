# Express.js Architecture

## 🚂 The Express Engine and Routing Switchboard

Writing raw HTTP servers in native Node.js is tedious. Parsing JSON bodies, managing URLs, and handling headers require dozens of lines of repetitive boilerplate.

**Express.js** is a fast, unopinionated web framework built directly on top of Node's native `http` module. It acts as a massive abstraction layer, giving you clean, readable methods to handle complex network traffic.

## 1. Engine Initialization

At its core, an Express application is just a series of functions. To start an Express server, you must initialize the `app` object and bind it to a network port.

```javascript
import express from "express";

// 1. Initialize the Express Engine
const app = express();
const PORT = process.env.PORT || 3000;

// 2. Start listening for incoming network traffic
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
```

The `app` object is the beating heart of an Express.js application. Technically, it is a Node.js routing and middleware web framework instance. When you call const app = express(), you are creating a central registry that holds all your application's settings, routes, and middleware functions, and determines exactly how incoming HTTP requests should be handled.

### Primary functions you use to configure and run the app

`app.use([path], middleware)` : This mounts a middleware function. A middleware is simply a function that intercepts an incoming request before it reaches your final route. If you don't specify a path (e.g., app.use(cors())), it runs on every single incoming request.

`app.set(name, value)` : This assigns application-level configuration settings. You use it to define underlying server behaviors, such as app.set('trust proxy', 1) to tell Express it is sitting behind a cloud load balancer (like Render), or to configure a template engine.

`app.get(), app.post(), app.put(), app.delete()` : These are routing methods. They tell the app to listen for specific HTTP verbs on specific URL paths and execute a controller function when a match is found.

`app.listen(port)` : This binds the app to a specific network port on your machine and starts actively listening for incoming TCP connections.

**_The Rule of Sequence_**: In Express, order is literally everything. The pipeline executes top-to-bottom.

- The Logger must be at the very top (so it catches everything).
- The Error Handler must be at the very bottom (so it acts as a safety net if any routes above it explode).

## 2. The Routing Switchboard

Routing refers to how your application responds to a client request at a specific endpoint (URL) and a specific HTTP verb (GET, POST, etc.).

Express provides elegant, dedicated methods for every HTTP verb:

```javascript
// app.METHOD(PATH, HANDLER_FUNCTION)

app.get("/api/status", (req, res) => {
  res.send("Server is healthy!");
});

app.post("/api/users", (req, res) => {
  res.send("User creation triggered.");
});

app.delete("/api/users", (req, res) => {
  res.send("User deletion triggered.");
});
```

## 3. The Enriched Request & Response Objects

Express takes the raw, clunky Node.js `req` and `res` streams and injects powerful helper methods into them.

### The Request Object (`req`)

The `req` object represents the incoming data from the client. Express makes it incredibly easy to extract data from URLs:

- **`req.params` (URL Parameters):** Used for fetching specific, individual resources. You define them using a colon `:`.

```javascript
// Client requests: GET /api/users/99
app.get("/api/users/:id", (req, res) => {
  console.log(req.params.id); // Output: "99"
});
```

- **`req.query` (Query Strings):** Used for filtering, sorting, or pagination. They appear after a `?` in the URL.

```javascript
// Client requests: GET /api/users?role=admin&sort=asc
app.get("/api/users", (req, res) => {
  console.log(req.query.role); // Output: "admin"
  console.log(req.query.sort); // Output: "asc"
});
```

- **`req.body`:** The JSON payload sent in POST/PUT requests. _(Note: This requires middleware to function, which we will cover in the next module)._

### The Response Object (`res`)

The `res` object handles packing the data and sending it back.

- **`res.json()`:** The most important method for API developers. It takes a standard JavaScript object, converts it to a JSON string, automatically sets the `Content-Type: application/json` header, and sends the response.
- **`res.status()`:** Chainable method to set the HTTP status code before sending.

```javascript
app.get("/api/profile", (req, res) => {
  // Setting a 200 OK status and sending JSON in one chained command
  res.status(200).json({
    success: true,
    user: {name: "Alice", role: "Developer"},
  });
});
```

## 4. Modular Routing (`express.Router`)

If you put all of your routes into a single `server.js` file, it will eventually become thousands of lines long. Enterprise applications solve this by splitting routes into separate files using `express.Router()`.

Think of a Router as a "mini-application" capable only of performing routing functions.

**File 1: `routes/userRoutes.js`**

```javascript
import express from "express";
const router = express.Router(); // Initialize the mini-app

// Notice we only define the relative path here
router.get("/", (req, res) => {
  res.json({message: "Get all users"});
});

router.post("/", (req, res) => {
  res.json({message: "Create a user"});
});

export default router;
```

**File 2: `server.js` (The Main Hub)**

```javascript
import express from "express";
import userRoutes from "./routes/userRoutes.js";

const app = express();

// "Mount" the router onto a specific base URL prefix
app.use("/api/users", userRoutes);

app.listen(3000);
```

**The Engine Mechanic:** When a user visits `/api/users/`, the main `app` intercepts it, sees the `/api/users` prefix, and hands the request over to the `userRoutes` mini-app to finish processing. This keeps your codebase perfectly organized!
