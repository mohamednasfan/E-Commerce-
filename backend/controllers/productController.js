import asyncHandler from "../middlewares/asyncHandler.js";
import Product from "../models/productModel.js";
import mongoose, { isValidObjectId } from "mongoose";
import {
  sanitizeText,
  sanitizeImageUrl,
  sanitizeComment,
  containsXss,
} from "../utils/sanitize.js";

// Strict numeric parsing: rejects booleans/objects/arrays/null/"" which
// Number() would coerce (true->1, ""->0, []->0). Only plain string/number.
const toFiniteNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const t = v.trim();
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const addProduct = asyncHandler(async (req, res) => {
  try {
    // NoSQL fix: req.fields comes from formidable/JSON. Never spread it
    // directly (allows $set operators + mass-assignment of rating/reviews).
    // Whitelist + strict type checks instead.
    const fields =
      req.fields !== null && typeof req.fields === "object" ? req.fields : {};
    const { name, description, price, category, quantity, brand } = fields;

    // Validation (strict type: objects like {$gt:""} must fail)
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }
    if (typeof brand !== "string" || brand.trim() === "") {
      return res.status(400).json({ error: "Brand is required" });
    }
    if (typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ error: "Description is required" });
    }
    const priceNum = toFiniteNumber(price);
    if (!Number.isFinite(priceNum)) {
      return res.status(400).json({ error: "Price is required" });
    }
    if (typeof category !== "string" || !isValidObjectId(category)) {
      return res.status(400).json({ error: "Category is required" });
    }
    const quantityNum = toFiniteNumber(quantity);
    if (!Number.isInteger(quantityNum)) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    // Stored-XSS fix: reject HTML / script payloads outright.
    if (containsXss(name) || containsXss(description) || containsXss(brand)) {
      return res.status(400).json({ error: "Invalid text content" });
    }

    // XSS fix: store plain text only, strip tags; allowlist image URLs.
    const cleanName = sanitizeText(name, 200);
    const cleanDescription = sanitizeText(description, 5000);
    const cleanBrand = sanitizeText(brand, 200);
    if (!cleanName || !cleanDescription || !cleanBrand) {
      return res.status(400).json({ error: "Invalid text content" });
    }
    const product = new Product({
      name: cleanName,
      description: cleanDescription,
      price: priceNum,
      category,
      quantity: quantityNum,
      brand: cleanBrand,
      image:
        typeof fields.image === "string"
          ? sanitizeImageUrl(fields.image, "no-image")
          : "no-image",
      countInStock: (() => {
        const c = toFiniteNumber(fields.countInStock);
        return Number.isFinite(c) ? c : quantityNum;
      })(),
    });
    await product.save();
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const updateProductDetails = asyncHandler(async (req, res) => {
  try {
    // NoSQL fix: whitelist update fields. Spreading req.fields allows
    // {"$set":{"price":0}} to execute as update operators.
    if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const fields =
      req.fields !== null && typeof req.fields === "object" ? req.fields : {};
    const { name, description, price, category, quantity, brand } = fields;

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }
    if (typeof brand !== "string" || brand.trim() === "") {
      return res.status(400).json({ error: "Brand is required" });
    }
    if (typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ error: "Description is required" });
    }
    const priceNum = toFiniteNumber(price);
    if (!Number.isFinite(priceNum)) {
      return res.status(400).json({ error: "Price is required" });
    }
    if (typeof category !== "string" || !isValidObjectId(category)) {
      return res.status(400).json({ error: "Category is required" });
    }
    const quantityNum = toFiniteNumber(quantity);
    if (!Number.isInteger(quantityNum)) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    // Stored-XSS fix: reject HTML / script payloads outright.
    if (containsXss(name) || containsXss(description) || containsXss(brand)) {
      return res.status(400).json({ error: "Invalid text content" });
    }

    // XSS fix: store plain text only, strip tags.
    const cleanName = sanitizeText(name, 200);
    const cleanDescription = sanitizeText(description, 5000);
    const cleanBrand = sanitizeText(brand, 200);
    if (!cleanName || !cleanDescription || !cleanBrand) {
      return res.status(400).json({ error: "Invalid text content" });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name: cleanName,
        description: cleanDescription,
        price: priceNum,
        category,
        quantity: quantityNum,
        brand: cleanBrand,
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await product.save();

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const removeProduct = asyncHandler(async (req, res) => {
  try {
    if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

const fetchProducts = asyncHandler(async (req, res) => {
  try {
    const pageSize = 6;

    // NoSQL injection fix: strict whitelist of query keys.
    // With `simple` query parser, ?keyword[$ne]=null parses as
    // { "keyword[$ne]": "null" } so req.query.keyword is undefined and
    // would fall through to find({}) dumping all products.
    // Reject any key other than plain `keyword`.
    const queryKeys = Object.keys(req.query ?? {});
    if (queryKeys.some((k) => k !== "keyword")) {
      return res.status(400).json({ error: "Invalid search keyword" });
    }
    // Backstop for encoded operator keys regardless of parser
    // (e.g. ?keyword%5B$ne%5D=null). Allows literal `$` in values
    // like ?keyword=$20 which is safely escaped below.
    const rawUrl = req.originalUrl || "";
    if (/keyword\s*(%5b|\[)/i.test(rawUrl)) {
      return res.status(400).json({ error: "Invalid search keyword" });
    }

    // NoSQL injection fix: only accept keyword as a plain string.
    // Express extended query parser turns ?keyword[$gt]= into an object,
    // which must be rejected instead of passed to $regex.
    const rawKeyword = req.query.keyword;
    if (rawKeyword !== undefined && typeof rawKeyword !== "string") {
      return res.status(400).json({ error: "Invalid search keyword" });
    }

    let keyword = {};
    if (typeof rawKeyword === "string" && rawKeyword.trim() !== "") {
      // Cap length (ReDoS mitigation) and escape regex metacharacters
      // so user input is matched literally, not as a regex pattern.
      const safeKeyword = rawKeyword
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      if (safeKeyword) {
        // sanitizeFilter=true would otherwise wrap our own $regex in $eq
        // causing CastError. safeKeyword is escaped + capped above, so
        // mark only this server-built operator object as trusted.
        keyword = {
          name: mongoose.trusted({
            $regex: safeKeyword,
            $options: "i",
          }),
        };
      }
    }

    const count = await Product.countDocuments(keyword);
    const products = await Product.find(keyword).limit(pageSize);

    res.json({
      products,
      page: 1,
      pages: Math.ceil(count / pageSize),
      hasMore: false,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

const fetchProductById = asyncHandler(async (req, res) => {
  try {
    if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const product = await Product.findById(req.params.id);
    if (product) {
      return res.json(product);
    } else {
      res.status(404);
      throw new Error("Product not found");
    }
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: "Product not found" });
  }
});

const fetchAllProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find({})
      .populate("category")
      .limit(12)
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

const addProductReview = asyncHandler(async (req, res) => {
  try {
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { rating, comment } = body;
    if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    // NoSQL/store-injection fix: rating must be a finite number 1-5,
    // comment must be a plain string (reject {$gt:""} objects).
    // Strict: reject booleans (true->1) and "" (->0) that Number() coerces.
    const ratingNum = toFiniteNumber(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be 1-5" });
    }
    if (typeof comment !== "string" || comment.trim() === "") {
      return res.status(400).json({ error: "Comment is required" });
    }
    // Stored-XSS fix: reject HTML / script payloads outright (400) instead
    // of storing them. e.g. "<script>alert('XSS-review')</script>" must not
    // return 201. sanitizeComment below remains as defense-in-depth.
    if (containsXss(comment)) {
      return res.status(400).json({ error: "Invalid comment" });
    }
    if (comment.length > 1000) {
      return res.status(400).json({ error: "Invalid comment" });
    }
    const product = await Product.findById(req.params.id);

    if (product) {
      const alreadyReviewed = product.reviews.find(
        (r) => r.user.toString() === req.user._id.toString()
      );

      if (alreadyReviewed) {
        res.status(400);
        throw new Error("Product already reviewed");
      }

      // XSS fix: strip HTML tags from comment; sanitize stored username too
      // (protects old DB rows created before sanitization).
      const cleanComment = sanitizeComment(comment, 1000);
      if (!cleanComment) {
        return res.status(400).json({ error: "Invalid comment" });
      }
      const review = {
        name: sanitizeText(req.user.username, 50) || "Anonymous",
        rating: ratingNum,
        comment: cleanComment,
        user: req.user._id,
      };

      product.reviews.push(review);

      product.numReviews = product.reviews.length;

      product.rating =
        product.reviews.reduce((acc, item) => item.rating + acc, 0) /
        product.reviews.length;

      await product.save();
      res.status(201).json({ message: "Review added" });
    } else {
      res.status(404);
      throw new Error("Product not found");
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const fetchTopProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find({}).sort({ rating: -1 }).limit(4);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const fetchNewProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 }).limit(5);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const filterProducts = asyncHandler(async (req, res) => {
  try {
    // NoSQL injection fix: req.body arrives via express.json() so
    // {"checked":{"$ne":null}} would be an object. Enforce arrays
    // of primitives and validate every element before building query.
    const body =
      req.body !== null && typeof req.body === "object" ? req.body : {};
    const { checked = [], radio = [] } = body;

    if (!Array.isArray(checked) || !Array.isArray(radio)) {
      return res.status(400).json({ error: "Invalid filter parameters" });
    }

    let args = {};

    if (checked.length > 0) {
      const validCategoryIds = checked.every(
        (id) => typeof id === "string" && isValidObjectId(id)
      );
      if (!validCategoryIds) {
        return res.status(400).json({ error: "Invalid category filter" });
      }
      args.category = checked;
    }

    if (radio.length > 0) {
      if (radio.length !== 2) {
        return res.status(400).json({ error: "Invalid price filter" });
      }
      const min = toFiniteNumber(radio[0]);
      const max = toFiniteNumber(radio[1]);
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return res.status(400).json({ error: "Invalid price filter" });
      }
      args.price = mongoose.trusted({ $gte: min, $lte: max });
    }

    const products = await Product.find(args);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

export {
  addProduct,
  updateProductDetails,
  removeProduct,
  fetchProducts,
  fetchProductById,
  fetchAllProducts,
  addProductReview,
  fetchTopProducts,
  fetchNewProducts,
  filterProducts,
};
