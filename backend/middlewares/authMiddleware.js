import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import asyncHandler from "./asyncHandler.js";
import { isValidObjectId } from "mongoose";

const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Read JWT from the 'jwt' cookie
  token = req.cookies.jwt;

  // NoSQL hardening: cookieParser should give a string; reject objects like { $ne: null }.
  if (typeof token !== "string" || token.trim() === "") {
    res.status(401);
    throw new Error("Not authorized, no token.");
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // NoSQL hardening: userId from JWT payload must be a plain valid ObjectId string.
      if (
        !decoded ||
        typeof decoded.userId !== "string" ||
        !isValidObjectId(decoded.userId)
      ) {
        res.status(401);
        throw new Error("Not authorized, token failed.");
      }
      req.user = await User.findById(decoded.userId).select("-password");
      if (!req.user) {
        res.status(401);
        throw new Error("Not authorized, user not found.");
      }
      next();
    } catch (error) {
      res.status(401);
      throw new Error("Not authorized, token failed.");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized, no token.");
  }
});

const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401).send("Not authorized as an admin.");
  }
};

export { authenticate, authorizeAdmin };
