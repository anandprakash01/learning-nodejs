# Database Queries & MongoDB Basics

## Database Types

- **Relational DB (SQL DB):** MySQL, MSSQL, PostgreSQL etc.
- **Non Relational DB (No SQL DB):** MongoDB, Cassandra etc.

### Architecture Mapping

- **Relational DB:** Database => Tables => Row & Cols => Cell / Fields
- **Non Relational DB:** Database => Collections => Documents => Fields

### Core Concepts

- **BSON:** Binary JSON (How MongoDB physically stores data).
- **CRUD:** Create, Read, Update, Delete.
- **CLI (Command Line Interface):** Commands (Queries).
- **GUI (Graphical User Interface):** MongoDB Compass (Clicks).
- Database requires a server and a port to run.
- `localhost:27017` -> default for MongoDB.

---

## Insertion (Create)

A standard JSON Document looks like this:

```json
{
  "name": "John Doe",
  "mobileNo": "9876543210",
  "email": "john@email.com",
  "address": "123, ABC Street",
  "bloodGroup": "O+",
  "rollNo": "13245"
}
```

**SQL vs MongoDB Insertion:**

- **SQL:** `insert into students (John Doe, 9876543210)`
- **Mongo:** ```javascript
  db.students.insertOne({
  name: "Jack",
  mobileNo: "9876543211",
  email: "jack@email.com",
  address: "123, ABC Street",
  bloodGroup: "O-",
  rollNo: "13246"
  });

````

---

## Commands & Queries (Read, Update, Delete)

* `insert()`: To insert new record
* `find()`: To find records
* `update()`: To update records
* `delete()`: To delete records

**Basic Find:**
```javascript
db.students.find({ name: "John Doe" })
````

### MongoDB Operators

**Comparison Operators:**

- `$gt`: Greater than
- `$lt`: Less than
- `$gte`: Greater than or equal
- `$lte`: Less than or equal
- `$ne`: Not equal
- `$eq`: Equal
- `$in`: In array

**Logical Operators:**

- `$and`
- `$or`
- `$not`

---

## Query Examples

**Query to find the students whose age is greater than 20yrs:**

```javascript
db.students.find({
  age: {
    $gt: 20,
  },
});
```

**Query to find the students whose age is less than 30yrs:**

```javascript
db.students.find({
  age: {
    $lt: 30,
  },
});
```

**Query to find the students whose age is exactly 17yrs:**

```javascript
db.students.find({
  age: {
    $eq: 17,
  },
});
```

**Query to find the students whose age is between 30 and 50yrs:**
_(Logic: `if(age > 30 && age < 50)`)_

Using Explicit `$and`:

```javascript
db.students.find({
  $and: [
    {
      age: {$gt: 30},
    },
    {
      age: {$lt: 50},
    },
  ],
});
```

Using Implicit Syntax (Cleaner):

```javascript
db.students.find({
  age: {$gt: 30, $lt: 50},
});
```

**Query for all the products having price 499, 280 and 1249:**

```javascript
db.products.find({
  price: {
    $in: [499, 280, 1249],
  },
});
```

---

## Advanced Querying & Structure

### DB Schema (e-commerce example)

- `product`: id, price, name, qty
- `users`
- `orders` etc.

### Primary Key

A value which uniquely identifies a record in a collection/database.

- **MongoDB:** `_id` => UUID

### Regex: Pattern matching

Great for fuzzy searching text.

- **phone:** iPhone 9, iPhone X
- **shoe:** Mens shoes, womens shoes, kids shoes, reebok shoes, nike shoes etc.

### Update Strategies

- **Query First:** Find the document and then update it.
- **Update First:** Directly update the document.

---

## Pagination Math

- Page size = 10
- Total records = 101

**The Page Breakdown:**

- Page 1 => 1-10
- Page 2 => 11-20
- Page 3 => 21-30
- ....
- Page 11 => 101-110

**The Logic:**

- **PageNo 1:** Limit = 10, Skip => 0
- **PageNo 2:** Limit = 10, Skip => 10
- **PageNo 3:** Limit = 10, Skip => 20

**The Universal Formula:**
`skip = (pageNo - 1) * pageSize`
