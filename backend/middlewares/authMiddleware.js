import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import asyncHandler from "./asyncHandler.js";

const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.jwt;

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token.");
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500);
      throw new Error("JWT configuration is missing.");
    }

    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (!decoded || !decoded.userId) {
      res.status(401);
      throw new Error("Not authorized, invalid token payload.");
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(401);
      throw new Error("Not authorized, user not found.");
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized, token failed.");
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
