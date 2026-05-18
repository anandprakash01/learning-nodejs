/*==============================================================
This class takes the raw Mongoose Query object and the Express req.query object.
It chains Mongoose methods (.find, .sort, .skip, .limit) together before we actually await the final result.
==============================================================*/

class APIFeatures {
  constructor(query, queryString) {
    this.query = query; // The Mongoose Object (e.g., User.find())
    this.queryString = queryString; // The Express Object (req.query)
  }
  // 1. FILTERING
  filter() {
    const queryObj = {...this.queryString};
    // We must delete these special words so they don't break the database search
    const excludedFields = ["page", "sort", "limit", "fields"];
    // The Rule: If it's a command, put it in the array. If it's a database column (role, age, name), leave it out.
    excludedFields.forEach(el => delete queryObj[el]);

    // GET /api/users?role=user&age=25&sort=-createdAt&limit=5

    // THE NEW REGEX TRANSLATOR
    // Convert the JSON object into a raw text string
    let queryStr = JSON.stringify(queryObj);

    // The Mathematical Find-and-Replace
    // \b means "exact word boundary". We look for exactly gte, gt, lte, or lt. match is the word it found. We replace it with `$word`.
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Convert the text string back into a V8 JSON object
    const finalMongoFilters = JSON.parse(queryStr);

    // THE EXECUTION
    this.query = this.query.find(finalMongoFilters);
    return this;

    // this.query = this.query.find(queryObj);
    return this; // We return 'this' so we can chain the next method!
  }

  // 2. SORTING
  sort() {
    if (this.queryString.sort) {
      // If frontend sends "?sort=-role,name", Mongoose needs "-role name"
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      // Default Enterprise Fallback: Newest first
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  // 3. PAGINATION (The Ultimate Memory Protector)
  paginate() {
    const page = this.queryString.page * 1 || 1; // Convert string to Number
    const limit = this.queryString.limit * 1 || 10; // Default to 10 docs per page
    const skip = (page - 1) * limit;

    // .skip() tells MongoDB how many to ignore. .limit() tells it how many to grab.
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }

  // 4. FIELD LIMITING (Projection)
  limitFields() {
    if (this.queryString.fields) {
      // The frontend sends: ?fields=name,email,role
      // Mongoose requires: .select('name email role')

      const fields = this.queryString.fields.split(",").join(" ");

      // 🚨 THE MUTATION
      this.query = this.query.select(`${fields} -_id`);
      // In MongoDB, the _id is not just a column; it is the physical memory address of the document on the hard drive. It is the Primary Key. By default, MongoDB strictly refuses to drop the _id from a network response because it assumes the frontend will need it to identify the object.
    } else {
      // 🚨 THE ENTERPRISE DEFAULT
      // If the frontend doesn't ask for specific fields, we send everything EXCEPT the internal Mongoose version tracker (__v).
      // The minus sign (-) means "exclude this field".
      this.query = this.query.select("-__v");
    }
    // The Physics of .select()
    // Inclusion: If you pass positive strings (.select('name email')), Mongoose will only return those fields (plus the _id, which is always returned unless explicitly excluded).

    // Exclusion: If you pass negative strings (.select('-createdAt -role')), Mongoose will return everything except those fields.
    return this;
  }
}

export default APIFeatures;

// const users = await User.find();
// When your startup launches, this works fine for 10 users.
// In two years, when you have 100,000 users, calling User.find() tells the MongoDB hard drive to load 100,000 heavy BSON documents into V8 RAM all at the exact same millisecond.

// Your Node.js server will hit its memory limit and physically crash (FATAL ERROR: JavaScript heap out of memory).
// If it somehow survives, it will try to send a 500MB JSON payload over the network.
// The user's browser (React) will try to parse 500MB of text and crash their entire computer.
// We must build a Valve for the firehose. We need an Enterprise Query Builder that allows the frontend to request exact slices of data.

// The most important thing to understand about Mongoose is that User.find() does not immediately touch the database.
// If you write User.find() without await, Mongoose creates a massive C++ backed JavaScript object in RAM called a Query Object. Think of this object as an unsent envelope. You can keep writing instructions on the outside of this envelope (.sort(), .limit(), .skip()). The envelope is not physically mailed to the MongoDB hard drive until you put the await stamp on it.

// => Filtering: /api/users?role=user
// => Sorting: /api/users?sort=-createdAt (The minus sign means descending order)
// => Limiting (Pagination): /api/users?page=2&limit=10

// Before controller even runs, Express looks at that URL, rips off everything after the ?, and parses it into a standard V8 Object. It attaches this object to req.query.

// When you call new APIFeatures,
// this.queryString (The Ink): This holds the parsed URL object from Express (req.query, e.g., { role: 'user', sort: '-createdAt' }).
// => GET /api/users?role=user&sort=-createdAt&limit=5&page=2

// 1. The Shape of queryString (The Express Ink)
// this is the exact physical shape you would see:
// {
//   "role": "user",
//   "sort": "-createdAt",
//   "limit": "5",
//   "page": "2"
// }

// this.query (The Envelope): This holds the pending Mongoose Query Object (User.find()). It is sitting in RAM, waiting for instructions.

// 2. The Shape of query (The Mongoose Envelope)
// This is the complex one. When you type User.find() (without await), Mongoose creates a massive, heavy C++ backed Class instance called a Query.
// If you were to console.log(User.find()), your terminal would flood with thousands of lines of internal Mongoose architecture. But if we strip away the noise, the core shape of the Mongoose Query object looks roughly like this:
// A simplified look inside the Mongoose Query Object
// Query {
//   mongooseCollection: Collection { name: 'users' },
//   model: Model { User },

//   // 🚨 THE INSTRUCTION MANUAL
//   _conditions: {},   // This is where .find({ role: 'user' }) writes its data
//   options: {
//     sort: undefined, // This is where .sort('-createdAt') writes its data
//     skip: undefined, // This is where .skip() writes its data
//     limit: undefined // This is where .limit() writes its data
//   }
// }
// Notice that _conditions is empty, and the options are undefined. This is a blank envelope. It knows it is supposed to talk to the users collection, but it has zero instructions yet.

// const features = new APIFeatures(User.find(), req.query);

// => User.find() passes the massive, blank Mongoose Query object in as the first argument. It is saved as this.query.
// => req.query passes the tiny Express JSON dictionary in as the second argument. It is saved as this.queryString.

// The Mutation in Action (The sort example)
// If you were to look at the Mongoose Query object in memory after the .sort() method finishes, it has physically changed:
// The Mongoose Query Object AFTER .sort() is called
// Query {
//   mongooseCollection: Collection { name: 'users' },
//   model: Model { User },
//   _conditions: {},
//   options: {
//     sort: { createdAt: -1, role: -1, name: 1 }, // 🚨 IT HAS BEEN MUTATED! (-1 is MongoDB for descending)
//     skip: undefined,
//     limit: undefined
//   }
// }

// When you write User.find(), Mongoose does not return a generic JSON object. It reaches deep into its library and creates a brand new instance of a very specific, heavy class called the Mongoose Query Class.
// Because it is an instance of this class, it inherits dozens of highly specialized functions (methods) that are specifically designed to modify that "instruction envelope" we talked about earlier.

// Here are just a few of the methods natively built into the Mongoose Query prototype:

// => .find() (Used for filtering)
// => .sort()
// => .limit()
// => .skip()
// => .select()

// How this.query.sort() Physically Works
// In our APIFeatures constructor, we wrote:
// this.query = User.find();

// Because this.query is now holding that Mongoose Query object, it has access to every single one of those prototype methods.

// The Internal Mutation: The Mongoose .sort() function runs its internal logic. It goes into the envelope's options dictionary and changes sort: undefined to sort: { createdAt: -1 }.

// The Native Return: Here is the critical secret—Mongoose methods also return themselves. After mutating the options, the Mongoose .sort() function spits the entire mutated Query object back out.

// The Reassignment: We take that newly spit-out, mutated Query object and overwrite this.query in our RAM with it.

// The Next Level: Advanced Filtering (The Mathematical Symbols)
// You now have a perfect filter for exact matches (role=user). But what if you are building an Amazon clone and the frontend needs to find users who have spent greater than $500?

// A frontend cannot send a > or < symbol through an HTTP URL. It breaks the internet protocols. Instead, they use dictionary brackets:
// GET /api/users?spent[gte]=500  (gte stands for Greater Than or Equal)

// Express parses that URL into this V8 object:
// {
//   "spent": { "gte": "500" }
// }
// But MongoDB does not understand { "gte": "500" }. MongoDB specifically requires a dollar sign for mathematical operators: { "$gte": "500" }.

// Field Limiting (Projection)

// In MongoDB terminology, selecting specific columns to return is called Projection. If a table has 50 columns, but the React frontend only needs to render a list of names and profile pictures, sending all 50 columns is a massive waste of server RAM, network bandwidth, and the user's mobile data.

// We must build a valve that allows the frontend to explicitly state: "I only want the name and email columns. Drop everything else."

// The Mongoose Query Arsenal
// First, we must make a strict architectural distinction. .select() does not exist on User.
// User is the Model. It only knows how to start a search (.find(), .findOne(), .create(), .findById()).

// When you call User.find(), it spits out a Query.
// The Query is the envelope. .select() is a method on the Query.

// Here are the 5 most powerful Enterprise methods you can chain onto a Mongoose Query envelope:

// 1. .select(fields) (Projection)
// What it does: Dictates exactly which columns to pull from the hard drive.

// Usage: .select('name -password -__v')

// 2. .sort(criteria) (Ordering)
// What it does: Reorders the documents.

// Usage: .sort('-createdAt') (Newest first) or .sort('price') (Cheapest first).

// 3. .skip(number) and .limit(number) (Pagination)
// What they do: .skip tells the V8 engine how many documents to blindly step over. .limit tells it exactly when to stop reading.

// Usage: .skip(20).limit(10) (This gives you Page 3).

// 4. .countDocuments() (The Counter)
// What it does: This is a massive performance optimization. If your React frontend just wants to show a badge saying "1,402 Users", you do not want to download 1,402 documents.

// Usage: const total = await User.find({ role: 'user' }).countDocuments();

// The Physics: This command tells MongoDB to literally just count the memory addresses and return a single integer. It saves massive amounts of RAM.

// 5. .populate(path) (The SQL JOIN)
// What it does: MongoDB is a NoSQL database; it doesn't have tables, it has collections. But what if a User has created 5 Reviews, and you want to fetch the User and all their Reviews in one single network request?

// Usage: .populate('reviews')

// The Physics: This makes Mongoose run a second query in the background, fetch the Reviews, and physically inject them inside the User object before sending it to the frontend.
