# ODMs and ORMs

## 🌉 Bridging JavaScript and Databases

Databases and JavaScript speak two completely different languages. A SQL database speaks in rows, columns, and raw SQL strings (`SELECT * FROM users`). MongoDB speaks in BSON documents. Node.js, however, speaks in JavaScript Objects.

To bridge this gap without writing clunky, hard-to-maintain raw query strings inside our routes, the industry uses **ORMs** and **ODMs**.

## 1. Core Definitions

- **ORM (Object-Relational Mapper):** Used for SQL databases (PostgreSQL, MySQL). It maps two-dimensional database tables into deeply nested JavaScript objects. Popular examples: _Prisma, Sequelize, TypeORM_.
- **ODM (Object-Document Mapper):** Used for NoSQL Document databases (MongoDB). It maps database documents into JavaScript objects. Popular example: _Mongoose_.

**The Goal:** Both tools allow you to interact with your database using standard JavaScript methods (e.g., `User.find()`) instead of writing database-specific query languages.

## 2. Mongoose (The MongoDB ODM)

Because MongoDB is inherently "schemaless" at the database engine level, you could accidentally insert a user with a `username` string and another user with a `username` integer. This lack of structure can cause chaos in a large Node.js application.

**Mongoose solves this by enforcing a strict schema at the _Application Layer_ (inside Node.js) before the data ever reaches the database.**

### Schemas and Models

A **Schema** is the blueprint. A **Model** is the actual compiled JavaScript class used to query the database.

```javascript
import mongoose from "mongoose";

// 1. Define the Blueprint (Schema)
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "A username is required"],
      unique: true,
      trim: true,
    },
    age: {
      type: Number,
      min: [18, "User must be an adult"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {timestamps: true},
); // Automatically adds createdAt and updatedAt

// 2. Compile into a Model
const User = mongoose.model("User", userSchema);
export default User;
```

### Mongoose Middleware (Hooks)

One of Mongoose's most powerful enterprise features is the ability to run functions _just before_ or _just after_ a database operation. We will use this heavily to automatically hash passwords before saving them.

```javascript
// A "Pre-Save" Hook
userSchema.pre("save", async function (next) {
  console.log("About to save user:", this.username);
  // Hash password here...
  next();
});
```

## 3. Prisma (The Modern SQL ORM)

Historically, Node.js developers struggled with SQL ORMs like Sequelize because they were difficult to configure and lacked type safety. **Prisma** revolutionized the Node.js SQL ecosystem.

### The Single Source of Truth (`schema.prisma`)

Instead of defining schemas in JavaScript, Prisma uses a dedicated, declarative file format. This single file defines your tables, relationships, and constraints.

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  posts     Post[]   // A 1-to-Many Relationship
  createdAt DateTime @default(now())
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}
```

### The Prisma Client

When you run `npx prisma generate`, Prisma reads that file and automatically writes hundreds of lines of custom TypeScript/JavaScript code into your `node_modules`. This generated client provides absolute Type Safety and auto-completion in your code editor.

```javascript
import {PrismaClient} from "@prisma/client";
const prisma = new PrismaClient();

// Querying the database using the generated client
const getActiveUsers = async () => {
  const users = await prisma.user.findMany({
    where: {email: {endsWith: "@enterprise.com"}},
    include: {posts: true}, // Dynamically JOIN the posts table!
  });
  return users;
};
```

## 4. The Architectural Trade-Off

Why do some Senior Engineers dislike ORMs?

1. **The Abstraction Leak:** ORMs make simple queries (`findMany`) incredibly easy. However, for massive, highly complex analytical queries across 10 different tables, the ORM can generate highly inefficient SQL behind the scenes.
2. **The N+1 Problem:** If not configured properly, an ORM might accidentally execute 100 separate database queries to fetch a list of 100 users and their posts, instantly bottlenecking your server.

**The Enterprise Consensus:** Use ORMs/ODMs for 95% of your standard CRUD operations to maximize developer velocity and safety. For the 5% of hyper-complex reporting queries, bypass the ORM and write raw SQL or native MongoDB Aggregation pipelines.
