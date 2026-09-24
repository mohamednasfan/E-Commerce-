import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.json({ error: "Name is required" });
  }

  const existingCategory = await Category.findOne({ name });

  if (existingCategory) {
    return res.json({ error: "Already exists" });
  }

  const category = await new Category({ name }).save();
  res.json(category);
});

const updateCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const { categoryId } = req.params;

  const category = await Category.findOne({ _id: categoryId });

  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  category.name = name;

  const updatedCategory = await category.save();
  res.json(updatedCategory);
});

const removeCategory = asyncHandler(async (req, res) => {
  const removed = await Category.findByIdAndRemove(req.params.categoryId);
  res.json(removed);
});

const listCategory = asyncHandler(async (req, res) => {
  const all = await Category.find({});
  res.json(all);
});

const readCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id });
  res.json(category);
});

export {
  createCategory,
  updateCategory,
  removeCategory,
  listCategory,
  readCategory,
};
