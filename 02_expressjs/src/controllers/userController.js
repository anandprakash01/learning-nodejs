import jwt from "jsonwebtoken";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import APIFeatures from "../utils/APIFeatures.js";
import env from "../../config/env.js";

import {asyncHandler} from "../utils/asyncHandler.js";

const registerUser = asyncHandler(async (req, res) => {
  // 1. The Extraction Boundary (DTO) - The Data Transfer Object (DTO) Boundary
  // We explicitly pull ONLY the name and email from the memory stream. If the hacker sends "role": "admin" in req.body, it is completely ignored.
  // mongoose Schema will handle error if any of them is missing
  const {name, email, password} = req.body;

  // 2. Check if all fields are available
  if (!name || !email || !password) {
    // return res.status(400).json({
    //   success: false,
    //   message: "Please enter all fields",
    // });

    throw new AppError("Please enter all fields", 400);
  }

  // 3. If already registered
  const alreadyRegistered = await User.findOne({email});

  if (alreadyRegistered) {
    throw new AppError("User already registered!", 400);
  }
  // If you let the schema handle the duplication check, the flow looks like this:
  // => Receive request.
  // => Hash the password (blocks the Node.js event loop for ~100ms).
  // => Attempt to save to MongoDB.
  // => MongoDB rejects it because the email exists.

  // Receive Request: The controller says const newUser = new User(req.body).
  // Phase 2 (Mongoose Validation): Mongoose checks required, match, and minLength. The data looks perfectly valid.
  // Phase 3 (pre('save') Middleware): Mongoose triggers your hook. Node.js spends ~100ms grinding the password through bcrypt because it thinks the document is ready to be saved.
  // Phase 4 (Database Write): Mongoose sends the BSON payload over the network to MongoDB.
  // The Rejection: MongoDB looks at its physical unique index, sees the email already exists, and violently rejects the payload with an E11000 error.

  // You just wasted valuable CPU cycles hashing a password for a user that can never be created. By running await User.findOne({ email }) first, you check the database (which is very fast and doesn't block the event loop) and can reject the request before wasting resources on hashing.

  // 4. The Safe Object
  // We build a brand new object in RAM containing only the trusted data.
  const userData = {
    name,
    email,
    // Notice we do NOT include 'role'. Mongoose will automatically fall back to the default: 'user'.
    password,
  };

  // 5. The Secure Database Mutation
  // If this violates the Schema, it throws an error and instantly halts the function.
  const newUser = await User.create(userData);

  const tokenPayload = {id: newUser._id};

  const token = jwt.sign(tokenPayload, env.JWT_SECRET_KEY, {expiresIn: env.JWT_EXPIRE});

  // The Success Response
  res.status(201).json({
    success: true,
    message: "User created successfully.",
    data: {
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    },
  });
});

const loginUser = async (req, res) => {
  const {email, password} = req.body;

  // => 1. Business Logic: Did they provide both fields?
  if (!email || !password) {
    // Note: We use 400 (Bad Request)
    // throw new Error("Please provide an email and password");
    throw new AppError("Please provide an email and password", 400);
  }

  // => 2. The Database Query
  // We search by email. We use .select('+password') to force Mongoose to give us the hash so we can compare it.
  const user = await User.findOne({email}).select(
    "+password +failedLoginAttempts +accountLockedUntil",
  );

  if (!user) {
    throw new AppError("Email is not registered", 401);
  }

  // 🚨 THE VAULT CHECK: Is the door already locked?
  if (user.accountLockedUntil && user.accountLockedUntil > Date.now()) {
    const timeLeft = Math.ceil((user.accountLockedUntil - Date.now()) / 60000);
    throw new AppError(
      `Account temporarily locked due to multiple failed attempts. Try again in ${timeLeft} minutes.`,
      403,
    );
  }

  // => 3. The Authentication Failsafe
  // If the user doesn't exist, OR if the password math fails...
  // if (!user || !(await user.matchPassword(password))) {
  //   // Note: We use 401 (Unauthorized). We purposely give a vague error.
  //   // NEVER tell a hacker "User not found" or "Wrong password". It helps them guess.
  //   // throw new Error("Invalid credentials");
  //   throw new AppError("Invalid credentials", 401);
  // }

  if (!(await user.matchPassword(password))) {
    // 🚨 THE PENALTY: Wrong password. Increment the strikes.
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= 5) {
      // Set the lock timer for 15 minutes in the future
      user.accountLockedUntil = Date.now() + 15 * 60 * 1000;
    }

    // Save the penalty to the database without triggering validation rules
    await user.save({validateBeforeSave: false});
    // Save the penalty to the database without triggering validation rules
    throw new AppError("Incorrect email or password", 401);
  }

  // 🚨 THE SUCCESS RESET: The real user logged in successfully!
  // Wipe the slate clean so they don't get locked out next time.
  user.failedLoginAttempts = 0;
  user.accountLockedUntil = undefined;
  await user.save({validateBeforeSave: false});

  // => 4. The Passport Generation
  // We sign the payload (_id) with our secret key.
  const tokenPayload = {id: user._id};
  const token = jwt.sign(tokenPayload, env.JWT_SECRET_KEY, {expiresIn: env.JWT_EXPIRE});

  // 🚨 THE COOKIE PAYLOAD
  const cookieOptions = {
    httpOnly: true, // Prevents XSS attacks (Prevents client-side JS from reading the cookie)
    // secure: env.NODE_ENV === "production",// Only sends over HTTPS in production
    secure: true,
    // sameSite: "Strict", // Protects against Cross-Site Request Forgery (CSRF) attacks
    // sameSite: "Lax", // Allows cookies to be sent in cross-site requests under certain conditions
    sameSite: "None",
    // maxAge: 30 * 24 * 60 * 60 * 1000, // 30 day expiration in milliseconds
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Days
  };

  // What it takes: It specifically requires a native JavaScript Date object.

  // What happens if you leave it out: If you don't provide expires (or maxAge), the cookie becomes a Session Cookie. This means the browser will instantly delete the cookie the moment the user closes their browser window.

  // maxAge is actually a modern alternative to expires that accepts raw milliseconds directly, meaning you don't have to use new Date()!

  res.cookie("jwt", token, cookieOptions);

  // sending token in headers
  // res.setHeader("Authorization", "Bearer " + token);

  // => 5. The Response
  // We send back the passport to the user's browser.
  res.status(200).json({
    success: true,
    message: "User logged in successfully",
    data: {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
};

const getUserProfile = async (req, res) => {
  // We already have req.user from the protect middleware, but that user
  // was fetched without the ghost array. We need to fetch them again AND populate it.

  const user = await User.findById(req.user._id).select("-__v").populate({
    path: "reviews", // The name of the ghost field!
    select: "text rating -author", // We don't need the author ID, we already know who it is
  });

  res.status(200).json({
    success: true,
    message: "Profile data fetched successfully",
    data: {
      user,
    },
  });
};

const getUsers = asyncHandler(async (req, res) => {
  // console.log(req.query.sort.split(",").join(" "));

  // console.log(User.find());

  // const users = await User.find();

  // to handle the query strings
  // 1. We instantiate the Class. We do NOT use 'await' yet!
  // We are just building the instruction manual in RAM.
  const features = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // 2. We execute the final query.
  // THIS is when the TCP socket fires to the MongoDB hard drive.
  const users = await features.query;

  // 3. The Consistent Response
  res.status(200).json({
    success: true,
    message: "Fetched all user successfully",
    results: users.length, // Helpful for the frontend to know how many came back
    data: {
      users,
    },
  });
});

// admin only
const deleteUser = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin Access Granted. User deleted.",
    data: {
      user: {},
    },
  });
};

export {getUsers, registerUser, loginUser, getUserProfile, deleteUser};
