# CORS & The Final Security Pipeline

**Vulnerability 1: NoSQL Injection** (Covered previously)
**Vulnerability 2: The CORS Blockade**

### The Threat (Same-Origin Policy):

Google Chrome has a strict, hard-coded security rule: A website can only request data from its own exact domain and port.
If your React app is running on `http://localhost:5173`, and it tries to `fetch()` data from `http://localhost:3000`, the browser will violently block the request and throw a red CORS Policy Error in the console.

### The Solution (The `cors` package):

CORS is a backend mechanism to bypass this Chrome security rule. We tell Express to attach a special header to every response: `Access-Control-Allow-Origin`.
We use this header to explicitly tell Browser: "I am the server on port 3000. I officially give permission to port 5173 to read my data." Chrome reads the header, relaxes its security, and lets the data pass through.

---

## The Full Dictionary

- **`origin` (String | Array | Regex | Function):** Who is allowed in? You can pass an array of approved URLs: `['https://site-a.com', 'https://site-b.com']`.

  **The Regex Method (Best for subdomains):**

  ```javascript
  {
    // This Regex approves EXACTLY "yoursite.com" or ANY subdomain like "api.yoursite.com"
    origin: /^https:\/\/(.*\.)?yoursite\.com$/;
  }
  ```

  _The Origin header sent by browsers never includes a trailing slash or a path, so if you put one in your whitelist, the CORS check will fail!_

  Behind the scenes, the `cors` package checks the data type you assigned to origin.
  - If it sees a **String**, it does an exact text match.
  - If it sees an **Array**, it loops through to find a match.
  - If it sees a **Regex** (indicated by the `/.../` syntax), it automatically runs `.test(requestOrigin)` against the incoming request to see if it passes your Regex rules.

- **`methods` (String | Array):** What HTTP verbs are they allowed to use? Default is `GET,HEAD,PUT,PATCH,POST,DELETE`. You can lock it down to `methods: ['GET']` if it's a read-only public API.

- **`allowedHeaders` (Array):** If your React frontend tries to send a custom header (like `X-My-Custom-Header: Hello`), CORS will block it by default. You must explicitly list it here.

- **`exposedHeaders` (Array):** If your backend sends a custom header back to React, the Chrome browser will physically hide it from your JavaScript fetch response unless you list it here.

- **`credentials` (Boolean):** If `true`, this tells Chrome: "It is safe to attach the user's secret Cookies to this Cross-Origin request." (Crucial for JWTs stored in cookies).

- **`maxAge` (Integer):** Chrome sends a hidden "Preflight" (`OPTIONS`) request before every `POST` request just to ask permission. This slows down the network. `maxAge: 86400` tells Chrome to cache the permission for 24 hours so it doesn't have to ask twice.

### The Dynamic Function Method (Best for scaling)

```javascript
const whitelist = [
  "[https://site-a.com](https://site-a.com)",
  "[https://site-b.com](https://site-b.com)",
];

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

app.use(cors(corsOptions));
```

---

## Installing the Final Shields

```bash
npm install express-mongo-sanitize
npm i xss-clean
npm i cors
```

```javascript
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import cors from "cors"; // Fixed typo here
```

### 1. THE BROWSER GATEWAY

Implement CORS.
In development, you can leave it empty to allow all.
In production, you strictly lock it to your frontend domain!

```javascript
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5000"],
    credentials: true, // 🚨 REQUIRED if you are sending JWTs in Cookies!
  }),
);
```

### 2. THE NETWORK SHIELDS (Installed previously)

```javascript
app.use(helmet());

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP.",
});
app.use("/api", limiter);
```

### 3. THE BODY PARSER

This reads the JSON body. We limit it to 10kb so hackers can't send huge files to crash RAM.

```javascript
app.use(express.json({limit: "10kb"}));
```

### 4. THE DATA PURIFIERS (They MUST come AFTER express.json!)

**A. Data sanitization against NoSQL query injection**
Looks at `req.body`, `req.query`, and `req.params`, and rips out `$` and `.`.

```javascript
app.use(mongoSanitize());
```

**B. Data sanitization against XSS**
Cleans any user input from malicious HTML code.

```javascript
app.use(xss());
```

### 5. YOUR ROUTERS & ERROR HANDLERS

```javascript
app.use("/api/users", userRouter);
```

---

## The Conclusion

Take a step back and look at your `app.js` file. This is no longer a toy project. This is a production-ready, Enterprise-grade Node.js pipeline.

Every single request that hits your server must now survive:

- **The CORS Gateway** (Are you allowed to talk to me?)
- **The Helmet Armor** (Here are the rules for your browser.)
- **The IP Rate Limiter** (Are you spamming me?)
- **The Payload Size Check** (Is your JSON too heavy?)
- **The NoSQL Purifier** (Are you trying to trick the database?)
- **The XSS Purifier** (Are you trying to inject code?)

Only if a request survives all six of these physical checks does it finally reach your controllers.
