# Phase 1, Module 3: File System & Streams

## 📂 Topic: Handling Data, Memory, and I/O Operations

In a browser, JavaScript is strictly sandboxed. It cannot access your physical hard drive for security reasons. Node.js destroys this sandbox. Through the `fs` (File System) module, Node has full read/write access to the host operating system.

However, handling large files introduces a massive architectural challenge: **RAM constraints**. This module covers how Node solves memory limitations using Buffers and Streams.

---

## 1. Synchronous vs. Asynchronous I/O

The `fs` module provides two distinct ways to interact with files. Choosing the wrong one can instantly crash a production server.

### The Blocking Way (Synchronous)

```javascript
import fs from "fs";

// 🛑 WARNING: This blocks the V8 Event Loop!
const data = fs.readFileSync("./massive-database.json", "utf-8");
console.log(data);
```

When you use `readFileSync`, the V8 engine completely halts. If reading the file takes 3 seconds, your server cannot respond to any other incoming HTTP requests for those 3 seconds. **You should only use Sync methods during the initial server boot sequence, never inside an API route.**

### The Non-Blocking Way (Asynchronous Promises)

```javascript
import fs from "fs/promises";

// ✅ SAFE: Offloaded to libuv's background thread pool
async function getFileData() {
  try {
    const data = await fs.readFile("./massive-database.json", "utf-8");
    console.log(data);
  } catch (error) {
    console.error("File read failed:", error);
  }
}
```

Using the Promise-based `fs/promises` API pushes the heavy lifting to the `libuv` C++ background threads. The Event Loop remains completely free to serve other users while the file is being read.

---

## 2. Buffers: Raw Binary Memory

JavaScript was originally built to handle strings and numbers, not raw binary data like images, PDFs, or video streams. Node.js introduced **Buffers** to solve this.

A Buffer is a fixed-size chunk of memory allocated **outside** of the V8 JavaScript engine (it is allocated directly in C++). It represents a sequence of raw bytes (0s and 1s).

```javascript
// Allocating 4 bytes of memory
const buf = Buffer.alloc(4);

// Writing a string into the binary buffer
buf.write("Hey");

console.log(buf); // Output: <Buffer 48 65 79 00> (Hexadecimal representation)
console.log(buf.toString()); // Output: "Hey"
```

_Engine Mechanic:_ Whenever you read a file or receive an HTTP request payload without specifying an encoding (like `'utf-8'`), Node.js automatically returns a Buffer.

---

## 3. The Streaming Architecture

### The Problem with `readFile`

Even if you use the asynchronous `fs.readFile`, Node.js still attempts to load the **entire file** into the RAM before executing your callback.
If your server has 1GB of RAM, and a user uploads a 2GB video file, `fs.readFile` will cause a fatal **Heap Out Of Memory** crash.

### The Solution: Streams

Streams process data piece by piece (in chunks) rather than reading it all at once. The chunk is loaded into a Buffer, processed, and then the memory is immediately freed.

There are 4 fundamental types of Streams in Node.js:

1. **Readable:** Streams you can read from (e.g., `fs.createReadStream`).
2. **Writable:** Streams you can write to (e.g., `fs.createWriteStream`).
3. **Duplex:** Streams that are both readable and writable (e.g., A TCP network socket).
4. **Transform:** A Duplex stream that modifies the data as it passes through (e.g., `zlib.createGzip()` to compress data on the fly).

---

## 4. Piping (The Elegant Data Bridge)

The `.pipe()` method is one of the most powerful features in Node.js. It allows you to directly connect a Readable stream to a Writable stream.

It acts as an automatic pressure valve (handling "backpressure"). If the disk reads the file faster than the network can send it, `.pipe()` automatically pauses the reading process so the RAM doesn't overflow.

### Enterprise Example: Streaming a Video via HTTP

Here is how you securely serve a massive video file over an Express server using minimal RAM:

```javascript
import fs from "fs";
import express from "express";

const app = express();

app.get("/video", (req, res) => {
  // 1. Create a readable stream from the massive file
  const videoStream = fs.createReadStream("./huge-movie.mp4");

  // 2. The 'res' object in Express is a Writable Stream!
  // We simply pipe the file stream directly into the HTTP response stream.
  videoStream.pipe(res);

  // Error handling is critical for streams to prevent memory leaks
  videoStream.on("error", err => {
    res.status(500).send("Error streaming video");
  });
});
```

Because of `.pipe()`, this endpoint will consume less than 30MB of RAM, even if the video file is 10GB in size!
