import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const createCategory = asyncHandler(async (req, res) => {
  try {
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { name } = body;

    // NoSQL fix: reject objects like {"$ne":null} before findOne({name}).
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }

    const trimmedName = name.trim().slice(0, 32);
    const existingCategory = await Category.findOne({ name: trimmedName });

    if (existingCategory) {
      return res.json({ error: "Already exists" });
    }

    const category = await new Category({ name: trimmedName }).save();
    res.json(category);
  } catch (error) {
    console.log(error);
    return res.status(400).json(error);
  }
});

const updateCategory = asyncHandler(async (req, res) => {
  try {
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { name } = body;
    const { categoryId } = req.params;

    if (typeof categoryId !== "string" || categoryId.trim() === "") {
      return res.status(400).json({ error: "Invalid category id" });
    }
    // NoSQL fix: name must be a plain string, never an operator object.
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }

    const category = await Category.findOne({ _id: categoryId });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    category.name = name.trim().slice(0, 32);

    const updatedCategory = await category.save();
    res.json(updatedCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const removeCategory = asyncHandler(async (req, res) => {
  try {
    const removed = await Category.findByIdAndRemove(req.params.categoryId);
    res.json(removed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const listCategory = asyncHandler(async (req, res) => {
  try {
    const all = await Category.find({});
    res.json(all);
  } catch (error) {
    console.log(error);
    return res.status(400).json(error.message);
  }
});

const readCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id });
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
