import cluster from "cluster";
import express from "express";
import path from "path";
import {fileURLToPath} from "url";

const app = express();

// Derive __dirname inside an ES Module environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expose the public directory so the browser can fetch index.html
app.use(express.static(path.join(__dirname, "../public")));

// A simple HTTP Walkie-Talkie route to verify the worker is alive
app.use("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: `HTTP connection handled by Worker ${process.pid} with WorkerId:: ${cluster.worker.id}`,
  });
});

export default app;
