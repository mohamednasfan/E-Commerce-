import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import Product from "./backend/models/productModel.js";
import Category from "./backend/models/categoryModel.js";
import User from "./backend/models/userModel.js";

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas ✅");

    // Clear existing data
    await Category.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
    console.log("Cleared existing data");

    // Create Admin User
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);
    await new User({
      username: "Admin",
      email: "admin@store.com",
      password: hashedPassword,
      isAdmin: true,
    }).save();
    console.log("Created admin user ✅ (email: admin@store.com, password: admin123)");

    // Create categories
    const electronics = await new Category({ name: "Electronics" }).save();
    const clothing = await new Category({ name: "Clothing" }).save();
    const sports = await new Category({ name: "Sports" }).save();
    console.log("Created categories");

    // Create products
    const products = [
      {
        name: "Laptop Pro 15",
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600",
        brand: "TechBrand",
        quantity: 10,
        category: electronics._id,
        description: "A high-performance laptop with 16GB RAM, 512GB SSD, and a stunning 15-inch display.",
        rating: 4.5,
        numReviews: 12,
        price: 1299.99,
        countInStock: 8,
      },
      {
        name: "Wireless Noise-Cancelling Headphones",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
        brand: "AudioMax",
        quantity: 25,
        category: electronics._id,
        description: "Premium wireless headphones with 30-hour battery life and active noise cancellation.",
        rating: 4.8,
        numReviews: 34,
        price: 249.99,
        countInStock: 20,
      },
      {
        name: "4K Smart TV 55-inch",
        image: "https://images.unsplash.com/photo-1461151304267-38535e780c79?w=600",
        brand: "VistaScreen",
        quantity: 5,
        category: electronics._id,
        description: "Ultra-HD 4K Smart TV with built-in streaming apps and Dolby Atmos sound.",
        rating: 4.6,
        numReviews: 21,
        price: 699.99,
        countInStock: 4,
      },
      {
        name: "Men's Running Shoes",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
        brand: "SpeedRun",
        quantity: 50,
        category: sports._id,
        description: "Lightweight and breathable running shoes with superior cushioning for long distance runs.",
        rating: 4.3,
        numReviews: 18,
        price: 89.99,
        countInStock: 30,
      },
      {
        name: "Classic Denim Jacket",
        image: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600",
        brand: "UrbanWear",
        quantity: 30,
        category: clothing._id,
        description: "A timeless classic denim jacket suitable for all seasons. Available in multiple sizes.",
        rating: 4.2,
        numReviews: 9,
        price: 59.99,
        countInStock: 15,
      },
      {
        name: "Smartphone X12",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600",
        brand: "PhoneMax",
        quantity: 15,
        category: electronics._id,
        description: "Latest flagship smartphone with a 108MP camera, 5G support, and 256GB storage.",
        rating: 4.7,
        numReviews: 45,
        price: 999.99,
        countInStock: 10,
      },
    ];

    await Product.insertMany(products);
    console.log(`Inserted ${products.length} products ✅`);
    console.log("Database seeded successfully! 🌱");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding DB:", error.message);
    process.exit(1);
  }
};

seedDB();
