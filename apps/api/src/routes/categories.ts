import { Router } from "express";
import {
  GOOGLE_PRODUCT_TAXONOMY,
  searchCategories,
  getCategoryById,
  validateCategoryPath,
  suggestCategories,
} from "../lib/google/taxonomy";

const router = Router();

// Get all top-level categories
router.get("/", async (req, res) => {
  res.json({
    categories: GOOGLE_PRODUCT_TAXONOMY,
    count: GOOGLE_PRODUCT_TAXONOMY.length,
  });
});

// Search categories
router.get("/search", async (req, res) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!query) {
    return res.status(400).json({ error: "query_required" });
  }

  const results = searchCategories(query, limit);
  res.json({
    query,
    results,
    count: results.length,
  });
});

// Get category by ID
router.get("/:id", async (req, res) => {
  const category = getCategoryById(req.params.id);

  if (!category) {
    return res.status(404).json({ error: "category_not_found" });
  }

  res.json(category);
});

// Validate category path
router.post("/validate", async (req, res) => {
  const { categoryPath } = req.body;

  if (!categoryPath || !Array.isArray(categoryPath)) {
    return res.status(400).json({ error: "invalid_categoryPath" });
  }

  const isValid = validateCategoryPath(categoryPath);

  res.json({
    categoryPath,
    isValid,
    message: isValid
      ? "Category path is valid"
      : "Category path does not match Google taxonomy",
  });
});

// Suggest categories based on product info
router.post("/suggest", async (req, res) => {
  const { title, description } = req.body;
  const limit = parseInt(req.query.limit as string) || 5;

  if (!title && !description) {
    return res.status(400).json({ error: "title_or_description_required" });
  }

  const text = `${title || ""} ${description || ""}`;
  const suggestions = suggestCategories(text, limit);

  res.json({
    suggestions,
    count: suggestions.length,
  });
});

export default router;
