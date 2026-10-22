Multer: The File Catcher
Multer is a Node.js middleware specifically designed for handling multipart/form-data.

When a user submits a standard web form (like a username and password), the browser sends it as application/x-www-form-urlencoded or application/json. Express has built-in parsers for these. However, when you upload a file, the browser sends it as multipart/form-data. This means the file is broken into binary chunks and sent alongside the text fields. Express does not know how to read this format out of the box.

How Multer Works:

Interception: When a request hits a route protected by Multer (like your /upload route), Multer intercepts the raw incoming data stream.

Parsing: It reads the boundary markers in the multipart/form-data payload to separate the text fields from the file chunks.

Storage: It streams the file chunks directly to a storage engine (either your computer's hard drive or RAM) without loading the entire file into Node's memory at once, which prevents your server from crashing on large uploads.

Attachment: Once the file is fully saved, Multer attaches a .file (or .files) object to the Express req object, and puts all the text fields into req.body.

Key Multer Configurations:

Storage Engines: You can use multer.diskStorage() to define exact folders and filenames on your server, or multer.memoryStorage() to keep the file in memory as a buffer (useful if you are uploading directly to AWS S3).

Limits: You can define maximum file sizes to prevent denial-of-service attacks by users uploading massive files.

File Filter: A function to inspect the file's MIME type (e.g., image/png or application/pdf) and reject unwanted files before they are even saved.
