import mongoose from "mongoose";
import Review from "../models/Review.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

const createReview = async (req, res) => {
  const {text, rating} = req.body;

  if (!text || !rating) {
    throw new AppError("All fields are required !");
  }
  // We take the author ID strictly from our secure req.user object!

  const newReview = await Review.create({
    text,
    rating,
    author: req.user._id, // 🚨 The Cryptographic Link is established here
  });

  res.status(201).json({
    success: true,
    message: "Review added successfully",
    data: {
      review: newReview,
    },
  });
};

const getReviews = async (req, res) => {
  // 1. Mongoose finds all reviews.
  // 2. .populate() looks at the 'author' field.
  // 3. It sees the ID, opens a SECOND connection to MongoDB, fetches the User document, and physically injects it over the ID string in RAM!
  // 4. We use the second parameter ('name email') to act as a valve, limiting what User data we pull.

  // const reviews = await Review.find().populate("author", "name email");
  const reviews = await Review.find({author: req.user._id}).populate(
    "author",
    "name email",
  );

  // When you run .populate(), MongoDB is not doing the heavy lifting. Mongoose is doing it in your Node.js RAM.
  // => Mongoose runs Query A: Fetch 10 Reviews.
  // => Mongoose looks at those 10 Reviews, extracts the 10 User IDs.
  // => Mongoose runs Query B: Fetch those 10 Users.
  // => Mongoose's C++ engine physically stitches the JSON objects together before sending them to res.json.

  // If you populate a list of 10,000 reviews, you are forcing Node.js to stitch 10,000 objects together in RAM. This is why we always use our APIFeatures pagination valve before we ever call .populate()

  res.status(200).json({
    success: true,
    message: "reviews fetched successfully",
    results: reviews.length,
    data: {
      reviews,
    },
  });
};

const updateReview = async (req, res) => {
  const isValid = mongoose.isValidObjectId(req.params.id);
  if (!isValid) throw new AppError("hey error", 400);
  // 1. We must verify the person updating it is the actual author
  const review = await Review.findById(req.params.id);

  if (!review) throw new AppError("No review found with that ID", 404);

  // Notice we must convert the ObjectId to a string before comparing it to the req.user._id string!
  if (review.author.toString() !== req.user._id.toString()) {
    throw new AppError("You can only update your own reviews", 403);
  }

  // 2. We use findByIdAndUpdate. This triggers the /^findOneAnd/ middleware we just built!
  const updatedReview = await Review.findByIdAndUpdate(
    req.params.id,
    {text: req.body.text, rating: req.body.rating},
    {new: true, runValidators: true}, // Return the new document, check max: 5 rules
  );

  res.status(200).json({
    success: true,
    message: "Review updated successfully",
    data: {review: updatedReview},
  });
};

const deleteReview = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Invalid ID", 400);

  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("No review found with the ID", 404);

  if (review.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new AppError("You do not have permission to delete this review");
  }

  await Review.findByIdAndDelete(req.params.id);

  // 1. FAST FAIL: The Single Database Trip
  // We use findOneAndDelete to check BOTH the review ID and the Author ID simultaneously.
  const deletedReview = await Review.findOneAndDelete({
    _id: req.params.id,
    author: req.user._id,
  });

  // 2. THE REJECTION
  // If 'review' is null, it means either the review doesn't exist,
  // OR this user is not the author. We reject them instantly.
  if (!deleteReview) {
    throw new AppError(
      "No review found, or you do not have permission to delete it",
      404,
    );
  }

  res.status(204).json({
    success: true,
    message: "Review deleted successfully",
    data: review,
  });
  // This is the Global Law of the Internet (RFC 7231).

  // The Network Protocol:
  // The HTTP status code 204 literally translates to "No Content".
  // When the Node.js HTTP server sees that you set the status to 204, it acts as a strict bouncer. It says: "The protocol forbids me from sending a body with a 204 status." It physically intercepts your JSON object, deletes it from RAM, and sends exactly zero bytes across the TCP socket
  //   The Strict REST Way: When you delete something, you return 204 and send absolutely nothing. The frontend knows that 204 means "Deletion Successful." It saves network bandwidth.

  // The Pragmatic Way: If your React developers need a confirmation message (like "Review deleted successfully"), you cannot use 204. You must change it to 200 OK.
};

export {createReview, getReviews, updateReview, deleteReview};
