process.on("uncaughtException", error => {
  console.log(`[FATAL] [PROCESS] Uncaught Exception, Shutting down...`);
  console.log(error.stack);
  process.exit(1);
});

// In modern JavaScript, import statements are hoisted. This means the Node.js engine reads the file and executes every single import statement at the top before it runs any of your standard code.

// Even though process.on("uncaughtException") is on line 1 of server.js, Node actually executes your imports for app.js and db.js first. If app.js throws a synchronous error, your safety net won't catch it because it hasn't been turned on yet!
