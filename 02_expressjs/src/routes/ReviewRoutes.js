import express from "express";

import {protect} from "../middlewares/authMiddleware.js";
import {
  createReview,
  getReviews,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";

const router = express.Router();

router.get("/", protect, getReviews);
router.post("/", protect, createReview);
router.patch("/update/:id", protect, updateReview);
router.delete("/delete/:id", protect, deleteReview);

export default router;
