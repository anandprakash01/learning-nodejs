# Handling File Uploads

## 📁 Multipart Forms and Binary Data

So far, we have only dealt with sending text-based JSON data using `express.json()`. However, you cannot send an image, PDF, or video inside a JSON string. Binary files require a completely different transmission protocol and a specialized middleware parser.

## 1. The `multipart/form-data` Protocol

When a frontend application needs to upload a file, it must change the HTTP `Content-Type` header from `application/json` to `multipart/form-data`.

This protocol splits the incoming HTTP request into multiple "parts." One part might contain standard text fields (like `username: "Alice"`), while another part contains the raw binary stream of the image file.

**The Problem:** Express's native `express.json()` and `express.urlencoded()` middlewares completely ignore `multipart/form-data`. If you try to read `req.body` on a file upload request, it will be `undefined`.

## 2. The Solution: Multer

To parse multipart data, the Node.js ecosystem relies on a third-party middleware called **Multer**. Multer intercepts the multipart stream, separates the text fields from the binary files, and attaches them to the Express `req` object.

- Text fields go to `req.body`.
- Single files go to `req.file`.
- Multiple files go to `req.files`.

**Parsing**: It reads the boundary markers in the multipart/form-data payload to separate the text fields from the file chunks.

**Storage**: It streams the file chunks directly to a storage engine (either your computer's hard drive or RAM) without loading the entire file into Node's memory at once, which prevents your server from crashing on large uploads.

**Attachment**: Once the file is fully saved, Multer attaches a .file (or .files) object to the Express req object, and puts all the text fields into req.body.

### Basic Multer Configuration (Memory Storage)

**Storage Engines :** You can use multer.diskStorage() to define exact folders and filenames on your server, or multer.memoryStorage() to keep the file in memory as a buffer (useful if you are uploading directly to AWS S3).

**Limits :** You can define maximum file sizes to prevent denial-of-service attacks by users uploading massive files.

**File Filter :** A function to inspect the file's MIME type (e.g., image/png or application/pdf) and reject unwanted files before they are even saved.

```javascript
import express from "express";
import multer from "multer";

const app = express();

// Configure Multer to store the incoming file as a Buffer in RAM
// const storage = multer.memoryStorage();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 5 * 1024 * 1024}, // 5MB limit to protect V8 memory!
});

// Inject the Multer middleware into the route
// 'avatar' is the exact field name sent by the frontend HTML form
app.post("/api/users/profile-pic", upload.single("avatar"), (req, res) => {
  console.log(req.body); // { username: "Alice" }
  console.log(req.file); // The binary file metadata and Buffer

  /* req.file looks like this:
    {
      fieldname: 'avatar',
      originalname: 'selfie.jpg',
      mimetype: 'image/jpeg',
      size: 204800,
      buffer: <Buffer ff d8 ff e0 00 10 4a 46 49 46 ... >
    }
    */

  res.json({message: "File received successfully!"});
});
```

## 3. The Local Disk Trap (Anti-Pattern)

Multer offers a `diskStorage` engine that automatically saves the uploaded file directly to a `/uploads` folder on your Node.js server.

**🚨 Architectural Warning:** While this works on your local laptop, it is a massive anti-pattern in production environments.

1. **Ephemeral Servers:** Cloud platforms (like Heroku, AWS ECS, or Docker containers) spin servers up and down based on traffic. If your server restarts, the local file system is wiped, and all user images are permanently deleted.
2. **Load Balancing:** If you have 3 Node.js servers running, and a user uploads an image to Server A, but later requests that image from Server B, it will return a 404 Not Found.

## 4. The Enterprise Architecture: Object Storage (S3 / Cloudinary)

In enterprise applications, the Node.js server never stores files permanently. It acts purely as a transit hub.

**The Execution Flow:**

1. The frontend uploads the file to Express.
2. Multer catches it and holds the binary chunk in RAM using `memoryStorage()`.
3. Your controller takes that Buffer (`req.file.buffer`) and securely streams it to a dedicated Cloud Object Storage provider like **AWS S3**, **Cloudinary**, or **Google Cloud Storage**.
4. The Cloud provider returns a permanent public URL (e.g., `https://res.cloudinary.com/image123.jpg`).
5. You save _only that URL string_ into your MongoDB or SQL database.

### Example Cloud Upload Flow:

```javascript
import {v2 as cloudinary} from "cloudinary";

// Inside your Express route controller...
const uploadToCloud = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({error: "No file provided"});

    // Convert the RAM Buffer into a base64 string for the Cloud SDK
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const cloudResponse = await cloudinary.uploader.upload(dataURI, {
      folder: "user_avatars",
    });

    // Save URL to Database (e.g., using Mongoose)
    // await User.findByIdAndUpdate(req.user.id, { avatarUrl: cloudResponse.secure_url });

    res.json({
      message: "Upload successful",
      url: cloudResponse.secure_url,
    });
  } catch (error) {
    res.status(500).json({error: "Cloud upload failed"});
  }
};
```
