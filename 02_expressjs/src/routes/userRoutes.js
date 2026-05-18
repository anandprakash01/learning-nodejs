import express from "express";
import rateLimit from "express-rate-limit";

import {
  registerUser,
  getUsers,
  loginUser,
  getUserProfile,
  deleteUser,
} from "../controllers/userController.js";
import {protect} from "../middlewares/authMiddleware.js";
import {restrictTo} from "../middlewares/authMiddleware.js";
import {validate} from "../middlewares/validate.js";
import {registerSchema, loginSchema} from "../validations/userValidation.js";

// const router = new express.Router();
const router = express.Router();

// In older versions of JavaScript, if a developer forgot to use the new keyword on a Constructor Function, the this context would bleed out into the global memory space and crash the application.

// To prevent this, the creators of Express.js wrote the Router function using a defensive pattern called a Factory Function.

// If you were to open the actual C++ / Node.js source code of Express (specifically lib/router/index.js), you would see something that looks exactly like this:

`// A simplified look inside the Express Source Code
function Router(options) {
  // THE DEFENSE MECHANISM
  // It checks: "Did the developer forget to use the 'new' keyword?"
  if (!(this instanceof Router)) {
    // If they forgot it, we will silently add it for them!
    return new Router(options);
  }

  // ... proceed to build the router object ...
}`;

const loginLimiter = rateLimit({
  max: 5, // Only 5 login attempts allowed
  windowMs: 30 * 60 * 1000, // ...per 30 min
  message: "Too many login attempts from this IP, please try again in 15 minutes.",
  skipSuccessfulRequests: true,
});

router.get("/", protect, restrictTo("admin", "architect"), getUsers);
router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);
router.get("/profile", protect, getUserProfile);

// 🚨 The Admin-Only Route
router.delete("/delete/:id", protect, restrictTo("admin", "architect"), deleteUser);

export default router;
