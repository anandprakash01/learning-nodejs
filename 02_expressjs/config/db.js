// When a user hits your API, they create an HTTP connection. It opens, sends data, and immediately closes.
// A database connection is fundamentally different. If your Node.js server had to open a brand new TCP (Transmission Control Protocol) connection to MongoDB every time a user registered, your server would crawl to a halt.
// Instead, when your server boots, Mongoose automatically opens a "Pool" of persistent, always-open TCP sockets (usually 5 to 10 by default) connecting your V8 engine to your MongoDB cluster.

import mongoose from "mongoose";
import env from "./env.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      // Limit each worker to 10 connections.
      // On an 8-core machine, this equals a safe 80 total connections. => check this in distributed nexus
      maxPoolSize: 10,
    });
    // By default, Mongoose does not just open 1 connection to MongoDB. It opens a "Pool" of 100 concurrent connections per Node.js process so it can handle lots of database queries at the exact same time.

    // If you have an 8-Core CPU, and all 8 Workers boot up and run connectDB()... you just instantly opened 800 simultaneous connections to your database!

    // If you are using the free tier of MongoDB Atlas (which limits you to 500 total connections), your application will crash the database immediately.

    // The Fix:
    // You need to limit the pool size in your config/db.js file so your workers share the load nicely.
    console.log(`[DATABASE] MongoDB Cluster Connected: ${conn.connection.host}`);
  } catch (error) {
    // The Fail-Fast Boot Sequence
    console.error(`🚨 [DATABASE CRASH]: Initial connection failed!`);
    console.error(error.message);
    process.exit(1); // Violently kill the V8 process. Do not accept HTTP traffic.
  }
};

// When mongoose.connect() establishes the TCP pool, it creates a persistent background object called mongoose.connection. This object acts like a radar. It constantly pings the database.
// If your WiFi drops, or if the AWS server hosting MongoDB goes down, the physical TCP socket breaks.
// The moment the socket snaps, the Mongoose radar detects it and automatically fires the .emit('disconnected') trigger.
// By writing .on('disconnected'), you are telling your server to listen for that radar blip so you can log the failure, rather than letting the server fail silently.

mongoose.connection.on("disconnected", () => {
  console.warn(
    `⚠️ [DATABASE] TCP connection lost at ${new Date().toLocaleString()} : Attempting to reconnect...`,
  );
});

mongoose.connection.on("reconnected", () => {
  console.log(`✅ [DATABASE] TCP connection restored at ${new Date().toLocaleString()}.`);
});

export default connectDB;
