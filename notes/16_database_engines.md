# Database Engines

## Relational (SQL) vs. Document (NoSQL) Architectures

Up until now, our Node.js server has only stored data in the V8 memory heap (RAM). When the server restarts, all that data is permanently destroyed. To build persistent applications, the server must connect to a dedicated Database Engine.

The backend industry is primarily divided into two architectural paradigms: **Relational (SQL)** and **Document (NoSQL)**.

## 1. Relational Databases (SQL)

**Examples:** PostgreSQL, MySQL, SQLite, Microsoft SQL Server.

Relational databases have been the industry standard since the 1970s. They are built on strict mathematical set theory and emphasize absolute data integrity.

### The Architecture: Tables and Columns

Data is stored in rigid, two-dimensional structures called **Tables**.

- Every row (record) represents one entity.
- Every column represents a specific attribute (e.g., `email`, `age`).

### Strict Schemas & Normalization

SQL databases enforce a strict schema at the engine level. If your `Users` table dictates that `age` must be an integer, the database will physically reject a query trying to insert the string `"twenty"`.

Data is highly **Normalized**. This means you never duplicate data. If a User has many Posts, you do not store the posts inside the user. You store them in a separate `Posts` table and link them using a **Foreign Key** (e.g., `author_id`).

### When to use SQL:

- **Financial Systems:** Where data integrity (ACID compliance) is the absolute highest priority.
- **Complex Relationships:** When data is highly interconnected (e.g., Users have Orders, Orders have Products, Products have Categories) and you need to perform complex `JOIN` queries.
- **Predictable Data:** When you know exactly what your data structure will look like from day one.

## 2. Document Databases (NoSQL)

**Examples:** MongoDB, CouchDB, Amazon DocumentDB.

Document databases were popularized in the late 2000s alongside the rise of web applications, specifically designed to handle massive scale and unstructured data.

### The Architecture: Collections and Documents

Instead of tables and rows, NoSQL databases store data in **Collections** of **Documents**.
In MongoDB, a document looks almost exactly like a standard JavaScript JSON object (technically, it is saved as BSON - Binary JSON).

```json
{
  "_id": "64a1b2c3",
  "username": "alice_dev",
  "skills": ["Node.js", "React"],
  "address": {
    "city": "Seattle",
    "zip": "98101"
  }
}
```

### Flexible Schemas & Denormalization

Document databases are inherently schemaless at the engine level. You can have one document in a collection with 5 fields, and the very next document in the exact same collection with 50 completely different fields.

Data is often **Denormalized** (Embedded). Because joining separate collections in NoSQL is computationally expensive, you often embed related data directly inside the parent document for lightning-fast reads.

In a traditional SQL database (Normalized), you would store the User ID and Product IDs in the order, forcing the database to run expensive joins across the Users, Orders, OrderItems, and Products tables just to show a user their receipt.

In NoSQL, you embed a snapshot of that data right inside the order document:

```js
// NoSQL Denormalized Order Document
{
  "_id": "order_789",
  "userId": "user_123",
  "totalAmount": 1200,
  "shippingAddress": {
    "street": "MG Road",
    "city": "Indore",
    "pincode": "452001"
  },
  "items": [
    {
      "productId": "prod_55",
      "name": "Wireless Mouse",
      "priceAtPurchase": 800,
      "quantity": 1
    }
  ]
}
```

_**The Golden Rule**: If data is always viewed together (like an order and its items, or an event and its agenda), embed it. If data is viewed independently or grows infinitely (like a user's activity logs), separate it by reference._

### When to use NoSQL:

- **Rapid Prototyping:** When your application requirements are constantly changing and a rigid SQL schema would slow down development.
- **Unstructured Data:** IoT sensor data, event logging, or content management systems (where a blog post might have varying structures).
- **Massive Horizontal Scale:** NoSQL databases are typically easier to distribute across hundreds of physical servers (Sharding).

## 3. The Core Difference: Reading Data

The biggest architectural difference between the two is how you retrieve related data.

**The SQL Approach (Join at Read-Time):**
You query the database to stitch the tables together dynamically.

- _"Engine, get me the User from Table A, and JOIN it with the rows from Table B where the IDs match."_

**The NoSQL Approach (Pre-Joined Data):**
You structure your data so that it matches exactly how the frontend needs to consume it.

- _"Engine, get me the User document."_ (The posts, comments, and profile data are already embedded inside it as nested arrays/objects, requiring zero computational overhead to assemble).
