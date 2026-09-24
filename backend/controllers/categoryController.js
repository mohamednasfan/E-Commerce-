import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { isValidObjectId } from "mongoose";
import { sanitizeText, containsXss } from "../utils/sanitize.js";

const createCategory = asyncHandler(async (req, res) => {
  try {
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { name } = body;

    // NoSQL fix: reject objects like {"$ne":null} before findOne({name}).
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }
    if (containsXss(name)) {
      return res.status(400).json({ error: "Invalid category name" });
    }

    // XSS fix: strip tags, remove < > so HTML can never be stored.
    const trimmedName = sanitizeText(name, 32);
    if (!trimmedName) {
      return res.status(400).json({ error: "Invalid category name" });
    }
    const existingCategory = await Category.findOne({ name: trimmedName });

  const existingCategory = await Category.findOne({ name });

    const category = await new Category({ name: trimmedName }).save();
    res.json(category);
  } catch (error) {
    console.log(error);
    return res.status(400).json(error);
  }

  const category = await new Category({ name }).save();
  res.json(category);
});

const updateCategory = asyncHandler(async (req, res) => {
  try {
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { name } = body;
    const { categoryId } = req.params;

    if (
      typeof categoryId !== "string" ||
      categoryId.trim() === "" ||
      !isValidObjectId(categoryId)
    ) {
      return res.status(400).json({ error: "Invalid category id" });
    }
    // NoSQL fix: name must be a plain string, never an operator object.
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }
    if (containsXss(name)) {
      return res.status(400).json({ error: "Invalid category name" });
    }

    const category = await Category.findOne({ _id: categoryId });

  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

    // XSS fix: strip tags, remove < > so HTML can never be stored.
    const cleanName = sanitizeText(name, 32);
    if (!cleanName) {
      return res.status(400).json({ error: "Invalid category name" });
    }
    category.name = cleanName;

  const updatedCategory = await category.save();
  res.json(updatedCategory);
});

const removeCategory = asyncHandler(async (req, res) => {
  try {
    if (
      typeof req.params.categoryId !== "string" ||
      !isValidObjectId(req.params.categoryId)
    ) {
      return res.status(400).json({ error: "Invalid category id" });
    }
    const removed = await Category.findByIdAndDelete(req.params.categoryId);
    if (!removed) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(removed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const listCategory = asyncHandler(async (req, res) => {
  const all = await Category.find({});
  res.json(all);
});

const readCategory = asyncHandler(async (req, res) => {
  try {
    if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid category id" });
    }
    const category = await Category.findOne({ _id: req.params.id });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    console.log(error);
    return res.status(400).json(error.message);
  }
});

export {
  createCategory,
  updateCategory,
  removeCategory,
  listCategory,
  readCategory,
};
