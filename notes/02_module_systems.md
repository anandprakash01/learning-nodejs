# Module Systems & Dependency Resolution

## 📦 Code Encapsulation and Sharing Memory

By default, every file in Node.js is an isolated execution context. If you declare a variable `const db = "MongoDB"` in one file, another file cannot read it. To build scalable architectures, you must explicitly export data from one file and import it into another.

Node.js historically used **CommonJS**, but the JavaScript ecosystem has now standardized on **ES Modules (ECMAScript Modules - ESM)**. Understanding the physical differences between how the V8 engine parses these two systems is critical.

---

## 1. CommonJS (CJS) - The Legacy Standard

CommonJS was created specifically for Node.js before JavaScript had an official module system.

### The Syntax

- **Export:** `module.exports = { data }`
- **Import:** `const data = require('./file.js')`

### The Engine Mechanics (Synchronous & Dynamic)

When V8 encounters a `require()` statement, it completely halts the execution of the current file, physically locates the required file on the hard drive, executes it from top to bottom, and returns the exported object.

Because it is evaluated at runtime (dynamic), you can conditionally load modules inside `if` statements:

```javascript
// Valid in CommonJS
if (process.env.NODE_ENV === "production") {
  const logger = require("./productionLogger");
}
```

---

## 2. ES Modules (ESM) - The Modern Standard

ES Modules are the official standard for JavaScript (used natively in React, Vue, and modern browsers). Node.js now fully supports them.

### The Syntax

- **Export:** `export const data = ...` or `export default function() {}`
- **Import:** `import { data } from './file.js'`

### The Engine Mechanics (Asynchronous & Static)

ESM is fundamentally different. Before the V8 engine executes _any_ code, it does a static analysis pass. It scans all `import` statements, builds a massive dependency graph in memory, and wires the modules together.

Because it is statically analyzed, you **cannot** conditionally import a file using standard syntax. `import` statements must be at the absolute top level of the file.

```javascript
// ❌ INVALID in ESM (Syntax Error)
if (process.env.NODE_ENV === "production") {
  import logger from "./productionLogger.js";
}

// ✅ Valid ESM (Dynamic Import via Promise)
if (process.env.NODE_ENV === "production") {
  const {logger} = await import("./productionLogger.js");
}
```

### Enabling ESM in Node.js

By default, Node.js assumes all files are CommonJS. To switch your entire backend to the modern ESM architecture, you must add a flag to your `package.json`:

```json
{
  "name": "enterprise-backend",
  "version": "1.0.0",
  "type": "module"
}
```

_(Alternatively, you can rename individual files to `.mjs` to force ESM, or `.cjs` to force CommonJS)._

---

## 3. The Node.js Resolution Algorithm

When you import a module, how does Node physically find it on your hard drive? The engine follows a strict checklist:

1. **Core Modules:** It first checks if the string matches a Node C++ core module (e.g., `import fs from 'fs'`).
2. **File Paths:** If the string starts with `./` or `../`, it looks exactly at that relative file path.
3. **`node_modules` (The Tree Climb):** If it is just a string (e.g., `import express from 'express'`), Node looks inside the `node_modules` folder in the current directory. If it doesn't find it, it goes up one folder level to the parent directory and checks _that_ `node_modules` folder. It keeps climbing up to the root of your hard drive until it finds the package or throws a `MODULE_NOT_FOUND` error.

---

## 4. The `__dirname` Gotcha in ESM

In standard CommonJS, Node automatically injects two global variables into every file:

- `__dirname`: The absolute path to the current folder.
- `__filename`: The absolute path to the current file.

**When you switch to `"type": "module"`, these variables are completely stripped from the engine.**
If you need to construct an absolute path to a file (like pointing to an uploads folder), you must reconstruct `__dirname` using the modern `import.meta.url`:

```javascript
import path from "path";
import {fileURLToPath} from "url";

// 1. Convert the file:// URL to a physical system path
const __filename = fileURLToPath(import.meta.url);

// 2. Extract the directory name
const __dirname = path.dirname(__filename);

console.log("Current Directory:", __dirname);
```
