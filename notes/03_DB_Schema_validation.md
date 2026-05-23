# Mongoose: Schemas, Models, and Validation

## 1. MongoDB (Lawless) vs. Mongoose (Strict)

**MongoDB** is a NoSQL database written in C++. It stores data in a binary format called BSON. At its core, it is completely "schema-less" and lawless—it is perfectly happy to let you throw any random, unstructured data into a collection.

**Mongoose** is an ODM (Object Data Modeling) library that acts as the translator and strict border checkpoint.
Node.js (JavaScript) and MongoDB (C++/BSON) do not natively understand each other. Mongoose takes your JavaScript objects, formats them perfectly, translates them into C++ BSON commands, and sends them across the internet.

Before any data is allowed to enter the TCP socket to MongoDB, Mongoose inspects it against a **Schema**. If the data does not perfectly match this blueprint, Mongoose rejects it and throws an error before network bandwidth is wasted.

---

## 2. The Mechanics of the Schema

A Schema defines the structure, default values, and validation rules. However, a Schema on its own is just a blueprint in RAM; it doesn't do anything to the database until compiled.

1. **Define the Schema (`new mongoose.Schema({})`):** Write the blueprint (what fields exist and their types). This constructor purely creates a JavaScript object in RAM that defines the rules.
2. **Compile the Model (`mongoose.model('User', schema)`):** The `model` function is a Factory. It takes your blueprint and compiles it into a powerful Class. This compiled Class actually contains the functions to talk to the database (like `.find()`, `.create()`).
3. **Create Documents:** Use the Model to create individual instances (documents) that perfectly match your Schema.

---

## 3. SchemaType Options & Validators

### A. Schema Types (The Building Blocks)

Assigning a SchemaType tells the V8 engine to strictly enforce JavaScript memory types.

- **`String`**: Plain text.
- **`Number`**: Numeric values, including decimals.
- **`Boolean`**: `true` or `false`.
- **`Date`**: Standard JS Date objects (defaults to `Date.now`).
- **`Buffer`**: Used to store binary data (like images/files directly in the document).
- **`Mixed`**: A flexible type where anything goes. _Use sparingly, as Mongoose loses the ability to auto-validate deeply inside Mixed types._
- **`ObjectId`**: Stores the `_id` of another document to create relationships (joins) between collections.
- **`Array`**: Arrays of standard types (e.g., `[String]`) or nested sub-documents.
- **`Decimal128`**: High-precision decimals (prevents floating-point rounding errors in currency).
- **`Map`**: A key-value object where keys are strings, but values must all be the specified SchemaType.
- **`UUID`**: Universally Unique Identifiers (stored as binary data).

### B. Validators (The Enforcers)

- **`required`**: If `true`, the field must be provided, or Mongoose triggers a `ValidationError`.
- **`default`**: Sets a default value if none is provided.
- **`enum` (Strings/Numbers)**: An array of strictly allowed values. It acts as a strict Whitelist Dropdown Menu. If the value isn't in the array, Mongoose blocks the write.
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
- `unique` tells the actual MongoDB database to put a physical lock on that collection. If it fails, MongoDB throws a native Duplicate Key Error (Code `E11000`).
- **`index: true`**: Tells MongoDB to index this field to make searching it lightning fast.
- **`sparse: true`**: Tells MongoDB to only index documents that actually contain this field.

### E. Behavioral Options

- **`immutable`**: If `true`, the field can be set on creation, but never changed afterward (e.g., `createdAt`, `stripeCustomerId`).
- **`select`**: If `false`, Mongoose physically strips this field out of every read query automatically. Great for hiding passwords.
- **`alias`**: Creates a virtual property so you can use a clean name in code, but a short name in the DB to save space.
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

# Mongoose: DB Schema Validation

MongoDB is a NoSQL database. At its core, it is completely lawless.
MongoDB is a database written in C++. It stores data in a binary format called BSON. Node.js server speaks JavaScript. They do not natively understand each other.

Mongoose is an ODM (Object Data Modeling) library. It acts as the translator. It takes the JavaScript objects, formats them perfectly, translates them into C++ BSON commands, and sends them across the internet. Furthermore, MongoDB is "schema-less" (it lets you save anything). Mongoose forces strict rules (Schemas) so bad data cannot enter your database.

Think of Mongoose as the strict bouncer for your MongoDB database. By default, MongoDB is perfectly happy to let you throw any random, unstructured data into a collection. Mongoose steps in to bring order to that chaos, and the `mongoose.Schema` is its rule book.

Mongoose fixes this by acting as a strict border checkpoint inside the Node.js V8 engine. Before any data is allowed to enter the TCP socket to MongoDB, Mongoose inspects it against a Schema (a strict blueprint). If the data does not perfectly match the blueprint, Mongoose rejects it and throws an error before network bandwidth is wasted.

A Mongoose Schema defines the structure, default values, and validation rules for your documents. However, a Schema on its own doesn't actually do anything to the database. It is just a blueprint.

To use a Schema, you have to compile it into a Model.

---

## The Mechanics of the Schema

- **1. `new mongoose.Schema({})`: Define the Schema**
  Write the blueprint (what fields exist and their types). This is a constructor function. It does not talk to the database. It purely creates a Javascript object in RAM that defines the rules.

- **2. `mongoose.model('User', schema)`: Compile the Model**
  The Schema is just a blueprint; it cannot do anything. The model function is a Factory. It takes your blueprint and compiles it into a powerful Class. This compiled Class is what actually contains the functions to talk to the database (like `.find()`, `.create()`, `.updateOne()`). It provides the interface to query, create, update, and delete records in the database.

- **3. Create Documents:** Use the Model to create individual instances (documents) that perfectly match your Schema.

---

## SchemaType Options and Validators

### 1. Schema Types (The Building Blocks)

When you define a path (a field) in a schema, you assign it a SchemaType. This tells Mongoose what kind of data to expect and how to cast it. Tells the V8 engine to strictly enforce Javascript memory types.

- **`String`**: Plain text (e.g., "Hello").
- **`Number`**: Numeric values, including decimals (e.g., 42, 3.14).
- **`Boolean`**: `true` or `false`.
- **`Date`**: Standard JavaScript Date objects. Usually defaults to `Date.now`.
- **`Buffer`**: Used to store binary data (like images or small files directly in the document).
- **`Mixed`** (`mongoose.Schema.Types.Mixed`): A flexible data type where absolutely anything goes. Mongoose loses the ability to auto-validate or track changes deeply inside Mixed types, so use it sparingly.
- **`ObjectId`** (`mongoose.Schema.Types.ObjectId`): Usually used to store the `_id` of another document. This is how you create relationships (joins) between different collections.
- **`Array`**: Can be an array of standard types (e.g., `[String]`) or an array of nested sub-documents.
- **`Decimal128`**: For high-precision decimals (often used for exact currency calculations where floating-point math causes rounding errors).
- **`Map`**: A key-value object where the keys are strings, but the values must all be of the same specified Schema Type.
- **`UUID`**: Universally Unique Identifiers (typically stored as binary data under the hood).

### 2. Validators (The Enforcers)

**For ALL Schema Types:**

- **`required`**: Boolean or function. If `true`, the field must be provided. If this field is missing from the user's request, Mongoose triggers a validation error.
- **`default`**: Sets a default value if none is provided.
- **`select`**: Boolean. If `false`, this field is hidden from query results by default (useful for passwords). By setting `select: false`, Mongoose physically strips the password out of every single read query automatically. The only way to get it is to explicitly demand it.

**For String:**

- **`enum`**: An array of strictly allowed string values. Enum stands for "Enumerated Type." It is a concept from low-level languages like C and Java that Mongoose simulates in JavaScript.
- **`match`**: A Regular Expression the string must pass.
- **`minLength` / `maxLength`**: Restricts the character count of the string.

**For Number:**

- **`min` / `max`**: Restricts the lowest and highest allowed numerical values.
- **`enum`**: An array of allowed numbers.

### 3. The Modifiers (Setters)

**String Modifiers:**

- **`trim`**: Removes whitespace from the beginning and end of a string.
- **`lowercase`**: Converts the string to all lowercase letters.
- **`uppercase`**: Converts the string to all uppercase letters.

**Custom Setter:**

```javascript
price: {
  type: Number,
  // Custom Setter: Always rounds the number to 2 decimal places before saving
  set: v => Math.round(v * 100) / 100
}
```

### 4. The Index Options (The `unique` trap)

- **`unique: true`**
  `unique` is the biggest trick in Mongoose. It is not a validator. It is a helper to build a MongoDB Unique Index.
  - A validator runs in your Node.js application.
  - `unique` tells the actual MongoDB database to put a physical lock on that collection so no two documents can have the same value.
  - If a validation fails, Mongoose throws a `ValidationError`. If `unique` fails, MongoDB throws a native Duplicate Key Error (Error Code `E11000`).

**Other Index-Related Options:**

- **`index`**: Boolean. Explicitly tells Mongoose to create a standard index on this field to make searching by this field much faster.
- **`sparse`**: Boolean. Tells MongoDB to only index documents that actually contain this field (useful if you have a unique field, but some users don't have that field at all).

### 5. Behavioral Options

These tell Mongoose how to treat the field during the application's lifecycle.

- **`immutable`**: Boolean. If `true`, this field can be set when the document is created, but it can never be changed afterward. Great for things like `createdAt` or `stripeCustomerId`.
- **`alias`**: String. Creates a virtual property that gets and sets the value of another field. Useful if you want to use a short, ugly name in the database to save space, but a clean name in your code.
- **`select`**: Boolean. As mentioned previously, if `false`, Mongoose will intentionally leave this field out of query results unless you explicitly ask for it.

```javascript
pwd: {
  type: String,
  unique: true,      // Creates a unique index in the database
  index: true,       // Makes querying by username lightning fast
  select: false,     // Hidden by default
  alias: 'password'  // You can type user.password in your code, but it saves as 'pwd' in the DB
}
```

---

## `type: String` - `ValidationError`

If you set `type: String`, the V8 engine allocates memory and allows the user to type literally anything: "Admin", "apple", "12345".

By adding `enum: ['user', 'admin']`, you turn that open text field into a strict Whitelist Dropdown Menu.
When data hits this field, Mongoose physically loops through array. If the user's string does not exactly match one of those specific strings, Mongoose instantly throws a `ValidationError` and blocks the database write. It guarantees absolute data consistency for categories, statuses, and roles.

If you send the number `12345` into current email field, Mongoose will NOT throw an error. It will successfully save it to the database.
When you wrote `type: String` in your Schema, you did not create a "Validator" (a rule). You created a "Caster" (a memory instruction).

When Mongoose receives the number `12345`, it says:
"The Blueprint requires a String. The user gave me a Number. Before I panic and throw an error, can I mathematically convert this Number into a String?"
It runs standard V8 JavaScript coercion: `String(12345)`. Because this perfectly converts into the text `"12345"`, Mongoose smiles, passes the data through, and saves `"12345"` to MongoDB.

What if the hacker is smart, and instead of sending a Number, they send a raw JSON Object: `email: { "hacked": true }`?
Mongoose tries to run `String({ "hacked": true })`. The V8 engine completely fails to convert a complex object into a simple string.
When Mongoose physically cannot cast the data, it throws a completely different type of error. It is not a `ValidationError`. It is a `CastError`.

If you do not teach your globalErrorHandler to catch this specific C++ explosion, your user will get a massive, ugly stack trace.

---

## What is `__v: 0` inside the document?

This is called the Version Key (`versionKey`). Mongoose automatically injects this into every single document it creates.

**The Physics of Concurrency:**
Imagine you and another Administrator both open the exact same User document at the exact same millisecond.

You try to add a new string to an array inside that user.
The other Administrator tries to delete that entire array.
If both of your saves hit the database at the same time, the V8 engine and MongoDB could corrupt the data.

To prevent this, Mongoose uses Optimistic Concurrency Control.
When the document is created, it starts at Version 0. Every time a complex mutation happens (like modifying arrays), Mongoose silently changes it to `__v: 1`, then `__v: 2`. If your server tries to save a document, but the version number in RAM does not match the version number on the hard drive, Mongoose forcefully blocks the save and throws a `VersionError`.

It is an invisible shield protecting your data from simultaneous overwrite collisions.
