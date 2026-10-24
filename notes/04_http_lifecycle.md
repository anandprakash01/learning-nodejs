# The HTTP Lifecycle & Network Protocols

## 🌐 The Client-Server Conversation

Node.js allows you to build a server, but a server is useless if it cannot communicate with the outside world. The internet communicates using a standardized protocol called **HTTP (Hypertext Transfer Protocol)**.

Every time a user visits a website, submits a form, or clicks a button, a strict two-way conversation occurs:

1. The Client (Browser, Mobile App, Postman) sends an **HTTP Request**.
2. The Server (Your Node.js app) processes it and sends back an **HTTP Response**.

---

## 1. Anatomy of an HTTP Request

When a client wants something from your server, it packages a request. A raw HTTP request is just a block of text containing four distinct parts:

### A. The Endpoint (URL/URI)

The exact address the client is trying to reach (e.g., `https://api.myapp.com/users/123`).

### B. The HTTP Verb (Method)

The action the client wants to perform. REST API architecture maps these directly to Database CRUD (Create, Read, Update, Delete) operations:

- **`GET`** (Read): Retrieve data. (Never contains a body/payload).
- **`POST`** (Create): Submit new data to the server (e.g., creating a new user).
- **`PUT`** (Update): Completely replace an existing resource.
- **`PATCH`** (Update): Partially update an existing resource (e.g., changing just a password).
- **`DELETE`** (Delete): Remove a resource.

### C. The Headers

Metadata about the request. This is the hidden context the browser sends automatically.

- `Host`: The domain being requested.
- `Content-Type`: Tells the server what format the body is in (e.g., `application/json` or `multipart/form-data`).
- `Authorization`: Passes security credentials (like a JWT or API Key).

### D. The Body (Payload)

The actual data being sent. Usually formatted as a JSON string. (GET and DELETE requests typically do not have a body).

---

## 2. Anatomy of an HTTP Response

Once your Node.js server finishes querying the database, it must send a response back. The response has three parts:

### A. The Status Code

A 3-digit mathematical summary of what happened. You must memorize these categories:

In RESTful architecture, HTTP Status Codes are the universal language your backend uses to communicate with the frontend. Returning the correct code is critical for both security and frontend logic (e.g., Axios automatically throws an error for any code 400 or above).

They are divided into distinct "buckets" based on who is responsible for the outcome.

### The 2xx Series: Success (The Green Light)

The server successfully received, understood, and accepted the request.

- **`200 OK`**: The standard response for a successful HTTP request.
  - **When to use:** fetching a user (`GET`), updating a profile (`PUT`/`PATCH`), or standard logins.
- **`201 Created`**: The request succeeded, and a new resource was physically written to the database.
  - **When to use:** Only after a successful `POST` request (e.g., User Registration, Creating a Review).
- **`204 No Content`**: The server successfully processed the request, but is not returning any payload.
  - **When to use:** After a successful `DELETE` request. _(Note: The Node.js engine physically strips the JSON body away when it sees a 204)._
  - **The Physics of HTTP 204 No Content**:
    When you send `res.status(204).json(...)`, the response object is completely empty, but `200` works perfectly.
  - **The Network Protocol**:
    The HTTP status code 204 literally translates to "No Content".
    When the Node.js HTTP server sees that you set the status to `204`, it acts as a strict bouncer. It says: "The protocol forbids me from sending a body with a 204 status." It physically intercepts your JSON object, deletes it from RAM, and sends exactly zero bytes across the TCP socket to the React frontend.
  - **The Enterprise Standard**:

    **The Strict REST Way:** When you delete something, you return `204` and send absolutely nothing. The frontend knows that `204` means "Deletion Successful." It saves network bandwidth.

    **The Pragmatic Way:** If your React developers need a confirmation message (like "Review deleted successfully"), you cannot use `204`. You must change it to `200 OK`.

    This is not a bug in code, and it is not a bug in Express. This is the Global Law of the Internet (RFC 7231).

### The 3xx Series: Redirection

- **`301 Moved Permanently`**: The URL has changed.
- **`302 Found`**: Temporary redirect.

### The 4xx Series: Client Errors (The Bouncer)

The client (React/Mobile App) made a mistake. They sent bad data, forgot their passport (JWT), or asked for something that doesn't exist.

- **`400 Bad Request`**: The server cannot understand the request due to invalid syntax or bad data.
  - **When to use:** When **Zod** validation fails (e.g., user sent a string instead of a number, or an invalid email format), or when Mongoose throws a `ValidationError`.
- **`401 Unauthorized`**: The client must authenticate itself to get the requested response.
  - **When to use:** The user tried to access a protected route but did not provide a JWT, or the JWT is expired/tampered with. _(Think of this as "Unauthenticated")._
- **`403 Forbidden`**: The client's identity is known, but they do not have the clearance rights to access the content.
  - **When to use:** The user provided a perfectly valid JWT, but their role is "user" and the route requires "admin". The server understands the request, but actively refuses to authorize it.
- **`404 Not Found`**: The server cannot find the requested resource.
  - **When to use:** The frontend hit a URL that doesn't exist, OR they searched for a specific database ID that isn't there (e.g., `User.findById()` returned `null`).
- **`409 Conflict`**: The request conflicts with the current state of the server.
  - **When to use:** When Mongoose throws a Duplicate Key Error (`E11000`). For example, two users trying to register the exact same email address.
- **`422 Unprocessable Entity`**: The data is formatted correctly (perfect JSON), but contains semantic errors. _(Often used interchangeably with 400 in modern APIs)._
- **`429 Too Many Requests`**: The user has sent too many requests in a given amount of time.
  - **When to use:** This is automatically triggered by your **Express Rate Limiter** to stop brute-force attacks and DDoS attempts.

### The 5xx Series: Server Errors (The Engine Blown)

The client sent a perfect request, but the backend Node.js server catastrophically failed to process it.

- **`500 Internal Server Error`**: A generic error message given when an unexpected condition was encountered.
  - **When to use:** This is your catch-all. If your database connection drops, your AWS S3 bucket crashes, or your code throws an unhandled exception, your `globalErrorHandler` should catch it and return a 500 to prevent leaking the stack trace to the frontend.
- **`502 Bad Gateway`**: The server, while acting as a gateway or proxy, received an invalid response from the upstream server.
  - **When to use:** You usually don't write this in Node.js. This is triggered by your infrastructure (like **Nginx** or **Cloudflare**) when your Node.js application completely crashes or freezes.
- **`503 Service Unavailable`**: The server is not ready to handle the request (usually down for maintenance or overloaded).
  - **When to use:** When you are intentionally taking the API offline for database migrations, or if the server CPU is maxed out.

### B. The Headers

Metadata sent back to the client.

- `Content-Type`: Tells the browser how to parse the response (e.g., rendering HTML vs. parsing JSON).
- `Set-Cookie`: Instructs the browser to save a cookie.

### C. The Body

The HTML page, the JSON data, or the raw image file requested.

---

## 3. The Native Node `http` Module

Node.js has a built-in module to handle HTTP traffic.

```javascript
import http from "http";

// Creating a raw Node.js server
const server = http.createServer((req, res) => {
  // Manual Routing (The Switchboard)
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({message: "Welcome to the API"}));
  } else if (req.url === "/users" && req.method === "POST") {
    // Parsing the body manually in native Node is extremely tedious
    // You have to listen to data streams and buffer chunks...
    res.writeHead(201);
    res.end("User created");
  } else {
    res.writeHead(404);
    res.end("Route not found");
  }
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
```

### The Problem with Native HTTP

As you can see, routing manually with `if/else` statements is messy. Furthermore, if a client sends a `POST` request with JSON, extracting that JSON from the raw incoming data stream in native Node requires writing complex Buffer concatenations.

### The Solution: Express.js

To avoid writing hundreds of lines of boilerplate code just to parse JSON and route URLs, the industry standardizes on web frameworks. In Module 2, we will introduce **Express.js**, which abstracts all of this raw HTTP networking into elegant, readable functions.
