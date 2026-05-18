/*================================================================
This middleware protects routes. It verifies the math of the JWT, 
fetches the user from the database, and physically attaches the user object to the 'req' stream so the next controller knows exactly who is logged in.
================================================================*/

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import env from "../../config/env.js";

const protect = async (req, res, next) => {
  const queryParams = req.query; // After the ? url
  const params = req.params;

  // const tokenBearer = req.headers.authorization?.startsWith("Bearer")
  //   ? req.headers.authorization.split(" ")[1]
  //   : null;

  let token;

  // => 1. Dual Extraction Logic

  // Check if the Authorization header exists and starts with "Bearer"

  // if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    // Split "Bearer eyJhb..." into an array and grab the second item (the token)
    console.log("Bearer Token Found!");
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt; // Extract from Cookie
  }

  // => 2. If no token was found
  if (!token) {
    throw new AppError("You are not logged in. Please log in to get access.", 401);
  }

  // => 3. Verify the Math (The Cryptography Check)
  // If the secret key matches, it returns the decoded payload: { id: "123...", iat: ..., exp: ... }
  // If the token is fake or expired, jwt.verify() throws an error automatically!
  const decoded = jwt.verify(token, env.JWT_SECRET_KEY);

  // => 4. Check if the user still exists in the database
  // What if they got a token, but an Admin deleted their account 5 minutes later?
  const currentUser = await User.findById(decoded.id).select("-__v");

  if (!currentUser) {
    throw new AppError("The user belonging to this token no longer exists.", 401);
  }
  // message: "Session expired, please login again!",

  // => 5. GRANT ACCESS
  // We attach the user document to the 'req' object.
  // This is a V8 memory trick. Because 'req' is passed to the next controller, the next controller can just read `req.user` without talking to the database again!
  req.user = currentUser;

  // => 6. Move to the next middleware/controller
  next();
};

// Notice the V8 Closure pattern here! Express requires middlewares to have the exact signature (req, res, next). But we need to pass roles into it.
// We write a function that returns a function!
const restrictTo = (...roles) => {
  // roles is an array: ['admin', 'architect']
  return (req, res, next) => {
    // req.user was attached by the 'protect' middleware right before this ran!
    if (!roles.includes(req.user.role)) {
      throw new AppError("You do not have permission to perform this action", 403);
    }
    // Authentication (401): "Who are you?" (The protect middleware).
    // Authorization (403): "I know exactly who you are, but you are not allowed to do this."
    next();
  };
};

export {protect, restrictTo};
