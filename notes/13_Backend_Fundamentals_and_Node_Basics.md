# Backend Fundamentals & Node.js Basics

## 1. NPM Ecosystem & Setup

- **Initialization:** `npm init` / `npm init -y`
- **Installation:** \* `npm i <package_name>` or `npm install <package_name>`
  - `npm i --save-dev <package_name>`: Adding the `--save-dev` (or `-D`) flag instructs the Node package manager to isolate this tool. It saves it under the "devDependencies" object in `package.json`.
- **The Physics:** This creates a strict environmental boundary. It tells the ecosystem: "This tool is only for my local machine."
- **Production Boundary:** When in production, install `--omit=dev`. This command explicitly tells Node.js to ignore everything in the "devDependencies" list.

### Publish module (common js file) in npm to use as npm-package:

1. Inside `package.json`, the name should be unique.
2. Change `main` to the module file name (which you want to publish).
3. `npm login`
4. `npm publish`

---

## 2. Architecture & Tech Stacks

### Client-Server Model

- **Client (Front End)**
- **Server (Back End):** Logic of the application, Stores Data.
  - **Java** => Hibernate, Struts, Spring, Spring Boot, JSP etc.
  - **PHP** => Laravel, CI (Code Igniter), Slim, Symphony
  - **Ruby** => RoR (Ruby on Rails)
  - **Python** => Django etc.
  - **GoLang** => ?
  - **C#** => MVC, Entity etc.
  - **JavaScript** => Express js, Ember js, Next js, etc.

### Framework vs Library

==> "React is a Library"

- **Library:** Small set of methods and Classes (Small Sized).
- **Framework:** Huge set of methods and Classes (Large sized).

### Node.js & Express

- **Node.js** is a Runtime Environment for JavaScript, Node Package manager.
- **ExpressJS** is a backend framework based on JavaScript. (Open Source Server-side as well as Mobile application).

### Stacks & Ecosystems

- **MERN:** Mongo, Express, React, and Node
- **MEAN:** Mongo, Express, Angular, and Node
- **Full Stack:** FE (HTML, CSS, JS) + BE (PHP/JAVA/PYTHON/Express)
- **Mobile Development:**
  - **Android:** Java based and Kotlin Language
  - **IOS:** Swift
  - **Hybrid Mobile development:** Ionic, Cordova, React Native, Flutter
  - **Progressive Web App (PWA)**

### JavaScript Engines

- **Google Chrome** => V8
- **Mozilla Firefox** => Spider Monkey
- **Edge** => Chakra

---

## 3. Node.js Core Basics

### Steps to setup a backend application based on NodeJS

1. Create a folder.
2. Run `npm init` in the folder.
3. Create an `index.js` file and write your code.
4. Run the file by running the command `node <filename>` e.g., `node index.js`.

### Core Modules

1. `os`
2. `fs`
3. `events`
4. `http`

### HTTP Server Creation

1. `http` module import
2. `http.createServer()`
3. `listen(portNo)`

_Created Server -> Listening on a port. Sent a request => Server emits a request event => Event listener is triggered._

---

## 4. APIs & REST Architecture

**API:** Application Programming Interface
**Postman:** It is a tool used to test the output of the APIs.

### Types of APIs:

- **SOAP (Simple Object Access Protocol)** => Envelops of Data (XML)
- **REST (Representational State Transfer)** => Raw data (JSON)

### RESTful APIs (HTTP Methods)

- **GET:** Used to retrieve the data from the server (e.g., Get the list of products, get a list of todos etc).
- **POST:** Used to send the data to the server in order to create a resource (e.g., Submitting a form, Placing an order etc).
- **PUT:** Used to replace the data on the server (e.g., Replace a social media post).
- **PATCH:** Used to update the record on the server (e.g., Update my profile etc).
- **DELETE:** Used to delete any record on the server (e.g., Delete my account etc).
- **OPTIONS:** Used to check if any resource is accessible to the server (Pre Flight Response - CORS).

### Static vs Dynamic APIs

- **Static API:** Which has same url and always return same set of data.
- **Dynamic API:** Which has a dynamic part in URL or in Body and sends different data when the dynamic part changes.

### Request/Response Cycle

- **Flow:** FrontEnd => BackEnd => Data Base => Backend => Frontend
- **API Flow:** React -> Backend (Node) | Client => Server

### Req and Response parts:

- **Header:** Meta data (Basic information of API, server name, origin details etc).
- **Body:** Actual requested/sent data.

### Environment Variables

- **Set:** Manual process done by a different way in different OS.
- **Get:** `process.env.VARIABLE_NAME`

---

## 5. Middleware & Design Patterns

### Middleware Flow

Request -> Middleware (`app.use()`) -> API End point -> Response
_Request -> Middleware 1 (`app.use`) -> Middleware 2 -> Middleware 3 -> "API End point" -> Middleware 4 -> Middleware 5 -> Middleware n -> Response_

- **Application Level Middleware:** Applies to the whole app (`app.use()`).
- **API Level:** Only effects a particular end point.
- **Module Level:** Applies to all the routes of a particular module.

**Serving Static Files:**

```javascript
app.use(express.static("files"));
// every file inside this folder can be directly accessed statically (Considered as a static file)
```

### Design Pattern: MVC (Model View Controller)

- **Controller:** Receives a request and performs business logic, sends the response.
- **Model:** It determines the structure of the data (e.g., username, dob, email).
- **View:** Where you see the UI (React JS).
- **Layers:** It is segregation of code.

---

## 6. Same Origin vs Cross Origin Policy (CORS)

CROSS ORIGIN POLICY IS IMPLEMENTED BY WEB BROWSERS.
**CORS:** Cross Origin Resource Sharing
**Origin:** Place from where your request is originated.

- **Cross Origin Example:**
  - Origin => `http://localhost:3000/`
  - Destination => `http://localhost:5000/`
  - Origin => `http://abc.com`
  - Destination => `http://xyz.com`
- **Same Origin Example:**
  - Origin => `https://google.com`
  - Destination => `https://google.com`

---

## 7. Databases & MongoDB Basics

We never Store PHYSICAL FILES inside a database like document, video, audio. Database is for Textual Data.

### Types of DB

- **Structured Database:** SQL (Structured Query Language)/RDBMS => MySQL, MSSQL, PostgreSQL, Oracle etc.
- **UnStructured Database / Non Relational Database:** MongoDB (MQL - Mongo Query Language), Dynamo DB, Cassandra DB etc.

### MongoDB Mapping

- **Rel DB:** Database => Tables => Row & Cols => Cell / Fields
- **Non Rel DB:** Database => Collections => Documents => Fields

- **BSON:** Binary JSON
- **CRUD Basics:** Create, Read, Update, Delete
- **CLI (Command Line Interface):** Commands (Queries)
- **GUI (Graphical User Interface):** MongoDB Compass : Clicks
- Database requires a server and a port to run. `mongodb://localhost:27017` -> default port.

### Basic Queries

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

**Insertion:**

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

**Commands:**
* `insert()`: To insert new record
* `find()`: To find records
* `update()`: To update records
* `delete()`: To delete records
```javascript
db.students.find({ name: "John Doe" })
````

**Operators:**

- **Comparison:** `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$eq`, `$in`
- **Logical:** `$and`, `$or`, `$not`

---

## 8. Authentication Flow Architecture

FrontEnd (Firebase) -> Token -> Custom API (Backend) -> Backend will call Google API -> Validate Google Token -> Our Backend will generate own JWT -> Frontend
