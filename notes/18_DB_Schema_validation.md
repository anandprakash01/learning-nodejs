# Database (Mongoose: Schemas, Models, and Validation)

**SQL (Relational Databases)**
SQL (Structured Query Language) databases are relational. They store data in highly structured tables with rows and columns, similar to an Excel spreadsheet.

Before you can add any data to an SQL database, you must define a strict **schema**—a blueprint that dictates exactly what columns exist and what data type (text, integer, date) goes into each.

SQL databases are excellent at handling complex relationships between different tables (e.g., linking a "Users" table to an "Orders" table).

Examples: MySQL, PostgreSQL, Oracle, SQLite.

**NoSQL (Non-Relational Databases)**
NoSQL databases do not use tables, rows, and strict schemas. Instead, they store data in a variety of flexible formats—most commonly as Document stores, Key-Value stores, Wide-Column stores, or Graph databases.

The biggest advantage of NoSQL is flexibility. You do not need to pre-define a schema. This makes NoSQL incredibly popular for modern web development, particularly in environments using JavaScript (like Node.js and React), because you can take a JSON(JavaScript Object Notation) object directly from your frontend or server and save it straight into the database without having to map it to strict tables.

Examples: MongoDB (Document), Redis (Key-Value), Cassandra (Wide-Column), Neo4j (Graph).

## 1. MongoDB (Lawless) vs. Mongoose (Strict)

**MongoDB** is a NoSQL database written in C++. It stores data in a binary format called BSON. At its core, it is completely "schema-less" and lawless—it is perfectly happy to let you throw any random, unstructured data into a collection.

**Mongoose** is an ODM (Object Data Modeling) library that acts as the translator and strict border checkpoint.
Node.js (JavaScript) and MongoDB (C++/BSON) do not natively understand each other. Mongoose takes the JavaScript objects, formats them perfectly, translates them into C++ BSON commands, and sends them across the internet. MongoDB is "schema-less" (it lets you save anything). Mongoose forces strict rules (Schemas) so bad data cannot enter your database.

Think of Mongoose as the strict bouncer for your MongoDB database. By default, MongoDB is perfectly happy to let you throw any random, unstructured data into a collection. Mongoose steps in to bring order to that chaos, and the `mongoose.Schema` is its rule book.

Mongoose fixes this by acting as a strict border checkpoint inside the Node.js V8 engine. Before any data is allowed to enter the TCP socket to MongoDB, Mongoose inspects it against a Schema (a strict blueprint). If the data does not perfectly match the blueprint, Mongoose rejects it and throws an error before network bandwidth is wasted.

A Mongoose Schema defines the structure, default values, and validation rules for your documents. However, a Schema on its own doesn't actually do anything to the database. It is just a blueprint.

---

## 2. The Mechanics of the Schema

A Schema defines the structure, default values, and validation rules. However, a Schema on its own is just a blueprint in RAM; it doesn't do anything to the database until compiled.

To use a Schema, you have to compile it into a Model.

1. **Define the Schema (`new mongoose.Schema({})`):** Write the blueprint (what fields exist and their types). This constructor purely creates a JavaScript object in RAM that defines the rules.

2. **Compile the Model (`mongoose.model('User', schema)`):** A Model is a compiled version of the Schema. It takes the blueprint (the Schema) and turns it into a fully functional JavaScript class/constructor that interacts directly with the MongoDB database.

   While the Schema just describes the data, the Model actually does the work. You use the Model to create, read, update, and delete (CRUD) documents in the database. This compiled Class actually contains the functions to talk to the database (like `.find()`, `.create()`).

3. **Create Documents:** Use the Model to create individual instances (documents) that perfectly match your Schema.

---

## 3. SchemaType Options & Validators

### A. Schema Types (The Building Blocks)

When you define a path (a field) in a schema, you assign it a SchemaType. This tells Mongoose what kind of data to expect and how to cast it. Tells the V8 engine to strictly enforce Javascript memory types.

- **`String`**: Plain text (e.g., "Hello").
- **`Number`**: Numeric values, including decimals (e.g., 42, 3.14).
- **`Boolean`**: `true` or `false`.
- **`Date`**: Standard JavaScript Date objects (defaults to `Date.now`).
- **`Buffer`**: Used to store binary data (like images or small files directly in the document).
- **`Mixed`** (`mongoose.Schema.Types.Mixed`): A flexible type where anything goes. _Use sparingly, as Mongoose loses the ability to auto-validate deeply inside Mixed types._
- **`ObjectId`** (`mongoose.Schema.Types.ObjectId`): Stores the `_id` of another document to create relationships (joins) between collections.
- **`Array`**: Arrays of standard types (e.g., `[String]`) or nested sub-documents.
- **`Decimal128`**: High-precision decimals (prevents floating-point rounding errors in currency).
- **`Map`**: A key-value object where keys are strings, but the values must all be of the same specified Schema Type.
- **`UUID`**: Universally Unique Identifiers (stored as binary data).

### B. Validators (The Enforcers)

- **`required`**: Boolean or function. If `true`, the field must be provided, or Mongoose triggers a `ValidationError`.
- **`default`**: Sets a default value if none is provided.
- **`enum` (Strings/Numbers)**: An array of strictly allowed values. Enum stands for "Enumerated Type". It acts as a strict Whitelist Dropdown Menu. If the value isn't in the array, Mongoose blocks the write. It is a concept from low-level languages like C and Java that Mongoose simulates in JavaScript.
- **`match` (Strings)**: A Regular Expression the string must pass.
- **`minLength` / `maxLength` (Strings)**: Restricts character count.
- **`min` / `max` (Numbers)**: Restricts lowest and highest allowed numerical values.

### C. The Modifiers (Setters)

- **`trim`**: Removes whitespace from the beginning and end of a string.
- **`lowercase` / `uppercase`**: Converts string casing.
- **Custom Setters**: Execute functions on the data before saving.

  ```javascript
  price: {
    type: Number,
    // Custom Setter: Always rounds the number to 2 decimal places before saving
    set: v => Math.round(v * 100) / 100
  }
  ```

### D. The Index Options (The `unique` Trap)

**`unique: true` is NOT a validator.** It is a helper to build a MongoDB Unique Index.

- A _validator_ runs in your Node.js application (throws a `ValidationError`).
- `unique` tells the actual MongoDB database to put a physical lock on that collection so no two documents can have the same value.. If it fails, MongoDB throws a native Duplicate Key Error (Code `E11000`).

**Other Index-Related Options:**

- **`index`**: Boolean. Explicitly tells Mongoose to create a standard index on this field to make searching by this field much faster.
- **`sparse`**: Boolean. Tells MongoDB to only index documents that actually contain this field (useful if you have a unique field, but some users don't have that field at all).

### E. Behavioral Options

These tell Mongoose how to treat the field during the application's lifecycle.

- **`immutable`**: If `true`, the field can be set on creation, but never changed afterward (e.g., `createdAt`, `stripeCustomerId`).
- **`select`**: Boolean. If `false`, Mongoose physically strips this field out of every read query automatically. Great for hiding passwords. The only way to get it is to explicitly demand it.
- **`alias`**:String. Creates a virtual property that gets and sets the value of another field. Useful if you want to use a short, ugly name in the database to save space, but a clean name in your code.

  ```javascript
  pwd: {
    type: String,
    unique: true,      // Creates a unique index in the database
    index: true,       // Makes querying by password fast
    select: false,     // Hidden from queries by default
    alias: 'password'  // Code uses 'user.password', DB saves as 'pwd'
  }
  ```

---

## 4. The Coercion Trap: `ValidationError` vs. `CastError`

When you write `type: String` in a Schema, you are creating a **"Caster"** (a memory instruction), not just a Validator.

If you set `type: String`, the V8 engine allocates memory and allows the user to type literally anything: "Admin", "apple", "12345".
By adding `enum: ['user', 'admin']`, you turn that open text field into a strict Whitelist Dropdown Menu.
When data hits this field, Mongoose physically loops through array. If the user's string does not exactly match one of those specific strings, Mongoose instantly throws a `ValidationError` and blocks the database write. It guarantees absolute data consistency for categories, statuses, and roles.

**Scenario A: Coercion Success**
If your schema expects a `String`, but the user sends the number `12345`, Mongoose does _not_ throw an error. It attempts standard V8 JavaScript coercion: `String(12345)`. It succeeds, converts it to text `"12345"`, and saves it.

**Scenario B: The `CastError` (C++ Explosion)**
If a hacker sends a raw JSON Object instead: `email: { "hacked": true }`.
Mongoose tries to run `String({ "hacked": true })`. The V8 engine completely fails to convert a complex object into a simple string. Because Mongoose physically cannot cast the data, it bypasses validation and throws a completely different error: a **`CastError`**.
_(Note: Your global error handler must be configured to catch CastErrors to prevent ugly stack traces from leaking to the client)._

---

## 5. The Version Key (`__v`) & Optimistic Concurrency

Mongoose automatically injects `"__v": 0` into every single document it creates. This is the **Version Key**, used for **Optimistic Concurrency Control**.

**The Physics of Concurrency:**
If two Administrators open the exact same User document at the same millisecond:

- Admin A tries to add a string to an array.
- Admin B tries to delete that entire array.
  If both saves hit the database simultaneously, it could corrupt the data.

To prevent this, every time a complex mutation happens, Mongoose silently increments the version (`__v: 1`, `__v: 2`). If your server tries to save a document, but the version number in RAM does not match the version number on the hard drive, Mongoose forcefully blocks the save and throws a `VersionError`. It is an invisible shield protecting your data from simultaneous overwrite collisions.

## 6. Schemas and Models

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
