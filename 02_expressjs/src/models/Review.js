import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "A review cannot be empty!"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "A review must have a rating!"],
    },
    author: {
      type: mongoose.Schema.ObjectId,
      ref: "User", // This tells Mongoose exactly WHICH model this ID belongs to!
      required: [true, "A review must belong to an author"],
    },
  },
  {timestamps: true},
);

reviewSchema.statics.calcAverageRatings = async function (authorId) {
  // 'this' points to the current Model (Review)
  // this.aggregate takes an array of "Stages" (like machines on an assembly line)
  const stats = await this.aggregate([
    // ===> STAGE 1: The Filter (Match)
    // Find every review in the database where the author matches this ID. This is exactly like .find({ author: authorId })
    {
      $match: {author: authorId},
    },
    // ===> STAGE 2: The Math (Group)
    // Take all the reviews that passed Stage 1, group them together, and run the math.
    {
      $group: {
        _id: "$author", // Group by the author's ID
        nRating: {$sum: 1}, // Add 1 for every review found
        avgRating: {$avg: "$rating"}, // Mathematically average the 'rating' column
      },
    },
  ]);
  // The 'stats' variable now holds an array looking exactly like this: [ { _id: '64f1b2...', nRating: 5, avgRating: 4.8 } ]

  // ===> STAGE 3: The Write-Back
  // if (stats.length > 0) ensures that the aggregation actually found reviews. If the array has items, it proceeds.
  // We open a connection to the User model and physically save the new math to their profile.
  if (stats.length > 0) {
    // We were inside Review.js. I needed to update a User. Normally, you would just write import User from './User.js' at the top of the file. However, in Enterprise Node.js, if User.js imports Review.js, and Review.js imports User.js, you create a "Circular Dependency." V8 memory traps itself in an infinite loop and crashes.
    // Writing mongoose.model("User") is a safe backdoor. It reaches directly into Mongoose's RAM and grabs the User model without needing an import statement.
    await mongoose.model("User").findByIdAndUpdate(authorId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    // If the user deletes all their reviews, reset them to default
    await mongoose.model("User").findByIdAndUpdate(authorId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

// .post means it runs AFTER the document is saved to the database.
reviewSchema.post("save", function () {
  // 'this' points to the exact review document that was just saved.
  // 'this.constructor' points to the Model that created it (Review).
  // We pass the author's ID into the Aggregation Pipeline!

  this.constructor.calcAverageRatings(this.author);
});
// Because it is a post('save') hook, it runs after a new review has been successfully saved to the MongoDB database. This timing is critical. If it ran before saving (pre('save')), the math would be wrong because the brand-new review wouldn't be in the database yet to be counted by the aggregation!

// Why this.constructor?
// We need to call our math function: calcAverageRatings().
// But remember from earlier, calcAverageRatings is a Static Method. Static methods live on the uppercase Model (e.g., Review), they do NOT live on the lowercase document (this).

// If you try to write this.calcAverageRatings(), your app will crash because the individual document doesn't own that function.

// You could try to write Review.calcAverageRatings(), but there is a big problem: at the point in the code where you define the Schema, the Review model usually hasn't been created yet (you define schemas before compiling them into models).

// The Solution:
// In JavaScript, every object instance has a built-in property called .constructor that points back to the class or function that created it.

// this = The newly saved review document.
// this.constructor = The Model (Review) that created this document.

// 🚨 THE QUERY TRIGGER (For Updates & Deletions)

// We use a Regular Expression /^findOneAnd/ to catch both: findOneAndUpdate AND findOneAndDelete (which is what Mongoose uses under the hood)

reviewSchema.post(/^findOneAnd/, async function (doc) {
  // 'this' no longer points to the document, because it's a Query Middleware.
  // Instead, 'doc' is the actual document that was just updated or deleted, passed back to us by Mongoose after the hard drive operation finishes.

  if (doc) {
    // Now we can access doc.constructor (the Review Model) and doc.author (the User ID) to trigger the math!
    await doc.constructor.calcAverageRatings(doc.author);
  }
});

const Review = mongoose.model("Review", reviewSchema);

export default Review;
