# HTTP Status Codes: The Enterprise Cheat Sheet

In RESTful architecture, HTTP Status Codes are the universal language your backend uses to communicate with the frontend. Returning the correct code is critical for both security and frontend logic (e.g., Axios automatically throws an error for any code 400 or above).

They are divided into distinct "buckets" based on who is responsible for the outcome.

---

## The 2xx Series: Success (The Green Light)

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

## The 4xx Series: Client Errors (The Bouncer)

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

---

## The 5xx Series: Server Errors (The Engine Blown)

The client sent a perfect request, but the backend Node.js server catastrophically failed to process it.

- **`500 Internal Server Error`**: A generic error message given when an unexpected condition was encountered.
  - **When to use:** This is your catch-all. If your database connection drops, your AWS S3 bucket crashes, or your code throws an unhandled exception, your `globalErrorHandler` should catch it and return a 500 to prevent leaking the stack trace to the frontend.
- **`502 Bad Gateway`**: The server, while acting as a gateway or proxy, received an invalid response from the upstream server.
  - **When to use:** You usually don't write this in Node.js. This is triggered by your infrastructure (like **Nginx** or **Cloudflare**) when your Node.js application completely crashes or freezes.
- **`503 Service Unavailable`**: The server is not ready to handle the request (usually down for maintenance or overloaded).
  - **When to use:** When you are intentionally taking the API offline for database migrations, or if the server CPU is maxed out.

---

## Enterprise Express Example

Here is how these status codes physically map to a standard Controller:

```javascript
export const updatePassword = async (req, res, next) => {
  try {
    const {currentPassword, newPassword} = req.body;

    // 1. 400 Bad Request (Missing Data)
    if (!currentPassword || !newPassword) {
      return res.status(400).json({error: "Please provide both passwords"});
    }

    const user = await User.findById(req.user.id).select("+password");

    // 2. 404 Not Found (Database miss)
    if (!user) {
      return res.status(404).json({error: "User no longer exists"});
    }

    // 3. 401 Unauthorized (Bad Credentials)
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({error: "Incorrect current password"});
    }

    user.password = newPassword;
    await user.save();

    // 4. 200 OK (Success)
    res.status(200).json({status: "success", message: "Password updated"});
  } catch (error) {
    // 5. 500 Internal Server Error (Something blew up)
    res.status(500).json({error: "Something went wrong on our end"});
  }
};
```
