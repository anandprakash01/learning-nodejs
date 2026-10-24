# Security Architecture

## 🛡️ Cross-Origin Resource Sharing (CORS)

CORS is a security mechanism enforced strictly by the **web browser**, not the backend server.

It controls whether a frontend application running at one origin is allowed to access data from a backend server running at a different origin.
**An `origin` is defined as the combination of the `protocol`, `domain`, and `port`.**

By default, browsers enforce the **Same-Origin Policy (SOP)**. If a user is on `http://localhost:5173` (your React frontend) and the JavaScript attempts to fetch data from `http://localhost:3000` (your Node API), the browser will execute the request, but it will immediately **block the response** from being read by the JavaScript.

_Why?_ To prevent malicious websites from making silent API calls to your bank or email provider using your saved session cookies.

CORS must be used whenever frontend and backend live on different domains, different subdomains, or different ports. The `cors()` middleware acts as a bouncer for your API. It attaches specific HTTP headers to your backend responses that explicitly tell the browser: _"It's safe, I allow this specific origin to read my data."_

---

## The Solution (The `cors` package)

CORS (Cross-Origin Resource Sharing) is a backend mechanism to bypass this Browsers security rule. We tell Express to attach a special header to every response: `Access-Control-Allow-Origin`.
We use this header to explicitly tell Browser: "I am the server on port 3000. I officially give permission to port 5173 to read my data." Chrome reads the header, relaxes its security, and lets the data pass through.

## 1. The Preflight Request (OPTIONS)

Before a browser sends a "complex" request (like sending a JSON payload via `POST`, `PUT`, or `DELETE`, or sending custom headers), it sends an invisible test request first.

1. **The Preflight:** The browser sends an `OPTIONS` request to the server asking, _"Are you going to accept my actual request?"_
2. **The Approval:** The server's CORS middleware responds with the allowed origins, methods, and headers.
3. **The Actual Request:** If the browser likes the answer, it sends the real `POST` request.

---

## 2. The Configuration Object

When you configure `app.use(cors({ ...options }))`, you are fine-tuning exactly who gets past the bouncer and what they are allowed to do.

### `origin` (String | Array | Regex | Function)

Who can access the API? Controls the `Access-Control-Allow-Origin` header.

- **String `{origin: 'http://localhost:5173'}` :** Limits access strictly to your frontend URL.\
  _The Origin header sent by browsers never includes a trailing slash or a path, so if you put one in your whitelist, the CORS check will fail!_

- **Wildcard `{origin: '*'}` :** Allows any website on the internet to hit your API (Public APIs).
- **Boolean `{origin: true}` :** A dynamic echo. The middleware reads the incoming `Origin` header and echoes that exact URL back.\
  _Crucial workaround: Browsers throw a fatal error if you use `origin: '*'` alongside `credentials: true`. Using `origin: true` acts as a shortcut to bypass this restriction._

- **Function `{origin: (origin, cb) => {}}` :** Used in SaaS platforms where users add custom domains. The function queries a database in real-time to verify the domain before allowing the request.
- **Regex `{origin: /^https:\/\/(.*\.)?yoursite\.com$/}` :** Best for subdomains. This Regex approves EXACTLY "yoursite.com" or ANY subdomain like "api.yoursite.com"

Behind the scenes, the `cors` package checks the data type you assigned to origin.

- If it sees a **String**, it does an exact text match.
- If it sees an **Array**, it loops through to find a match.
- If it sees a **Regex** (indicated by the `/.../` syntax), it automatically runs `.test(requestOrigin)` against the incoming request to see if it passes your Regex rules.

### `credentials` (Boolean)

Determines if the frontend is allowed to send sensitive data like Cookies, Authorization headers (JWTs), or TLS client certificates.

- `{credentials: true}`
- `{credentials: false}`

_If your frontend uses `axios.defaults.withCredentials = true` to send a login cookie, your backend **must** set `credentials: true`._

### `methods` (String | Array)

Dictates which HTTP verbs the origin can use (e.g., `['GET', 'POST', 'PUT', 'DELETE']`). Default is `GET, HEAD, PUT, PATCH, POST, DELETE`. You can lock it down to `{methods: 'GET'}` if it's a read-only public API. If a frontend tries to send a `PATCH` request and it isn't in this list, the browser blocks it.

### `allowedHeaders` (Array)

Controls which custom HTTP headers the frontend can send. If your frontend sends `Authorization: Bearer <token>` or `x-api-key`, the server must explicitly whitelist those headers here. If your React frontend tries to send a custom header (like `X-My-Custom-Header: Hello`), CORS will block it by default. You must explicitly list it here.

### `optionsSuccessStatus` (Legacy Support)

By default, Express CORS responds to the invisible `OPTIONS` preflight request with a `204 No Content` status. Some legacy browsers (like old Smart TVs or Internet Explorer 11) choke on a 204. Setting this to `200` ensures maximum compatibility across all devices.

### `exposedHeaders` (Array)

If your backend sends a custom header back to React, the Chrome browser will physically hide it from your JavaScript fetch response unless you list it here.

### `maxAge` (Integer)

Chrome sends a hidden "Preflight" (`OPTIONS`) request before every `POST` request just to ask permission. This slows down the network. `maxAge: 86400` tells Chrome to cache the permission for 24 hours so it doesn't have to ask twice.

## 3. Implementation Patterns

Here are the three standard architectural patterns for implementing CORS in an Express application.

```javascript
import express from "express";
import cors from "cors";

const app = express();

// ==========================================
// Pattern 1: Single Origin (Standard)
// ==========================================
const corsOptionsStandard = {
  origin: process.env.FRONTEND_URL, // e.g., 'http://localhost:5173'
  credentials: true, // 🚨 REQUIRED if you are sending JWTs in Cookies!
  methods: ["GET", "POST", "PUT", "DELETE"],
  optionsSuccessStatus: 200,
};

// ==========================================
// Pattern 2: Array Whitelist (Multi-tenant)
// ==========================================
const whitelist = [
  "[https://site-a.com](https://site-a.com)",
  "[https://site-b.com](https://site-b.com)",
  "http://localhost:3000",
  "http://localhost:5173",
];

const corsOptionsWhitelist = {
  origin: whitelist,
  credentials: true,
};

// ==========================================
// Pattern 3: Dynamic Function (Enterprise Scale)
// ==========================================
const corsOptionsDynamic = {
  origin: function (origin, callback) {
    // 1. Allow requests with no origin (like mobile apps, curl, or Postman)
    // Postman does not run inside a browser, so it doesn't send an Origin header!
    if (!origin) {
      return callback(null, true);
    }

    // 2. Check if the origin is in our whitelist array (or query a database)
    if (whitelist.includes(origin)) {
      callback(null, true); // (error is null, allow is true)
    } else {
      callback(new Error("Not allowed by CORS")); // Reject the request
    }
  },
  credentials: true,
};

// Apply the chosen configuration to the Express pipeline
app.use(cors(corsOptionsDynamic));
```

### 🧠 The Express Middleware Magic

Notice how we pass `corsOptionsDynamic` with a function, but we never explicitly write the code to _call_ that function.
This is the magic of the Express pipeline. Every time an HTTP request hits your server, the `cors` library steps in behind the scenes:

1. It grabs the `Origin` header from the incoming request.
2. It creates a special Node callback function.
3. It executes your custom function, passing those exact two arguments into it dynamically before the request is allowed to reach your controllers.
