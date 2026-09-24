import User from "../models/userModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import bcrypt from "bcryptjs";
import createToken from "../utils/createToken.js";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const isStrongPassword = (password) => PASSWORD_REGEX.test(password);

const createUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body ?? {};

  // NoSQL injection fix: reject non-string objects like {"$ne": null}
  // before they reach User.findOne(). Previous `if (!email)` was truthy
  // for objects and the missing `return` continued creation after 400.
  if (
    typeof username !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    username.trim() === "" ||
    email.trim() === "" ||
    password === ""
  ) {
    return res.status(400).json({ message: "Please fill all the inputs." });
  }

  const normalizedEmail = email.trim();
  const normalizedUsername = username.trim();
  const userExists = await User.findOne({ email: normalizedEmail });
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
    });
  }
  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newUser = new User({
    username: normalizedUsername,
    email: normalizedEmail,
    password: hashedPassword,
  });

  try {
    await newUser.save();
    createToken(res, newUser._id);

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
    });
  } catch (error) {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};

  // NoSQL injection fix: express.json() allows {"email":{"$ne":null}}.
  // Only accept plain non-empty strings so objects never reach findOne().
  // Uses direct return (not throw) so status is correct regardless of handler.
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim() === "" ||
    password === ""
  ) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const existingUser = await User.findOne({ email: email.trim() });

  if (!existingUser) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (existingUser.lockUntil && existingUser.lockUntil > Date.now()) {
    return res.status(423).json({
      message: "Account temporarily locked. Please try again later.",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, existingUser.password);

  if (isPasswordValid) {
    existingUser.loginAttempts = 0;
    existingUser.lockUntil = null;
    await existingUser.save();

    createToken(res, existingUser._id);

    res.status(200).json({
      _id: existingUser._id,
      username: existingUser.username,
      email: existingUser.email,
      isAdmin: existingUser.isAdmin,
    });
    return;
  }

  const maxLoginAttempts = 5;
  const lockDurationMs = 15 * 60 * 1000;
  const nextAttempts = (existingUser.loginAttempts || 0) + 1;

  existingUser.loginAttempts = nextAttempts;

  if (nextAttempts >= maxLoginAttempts) {
    existingUser.lockUntil = new Date(Date.now() + lockDurationMs);
    await existingUser.save();
    return res.status(423).json({
      message: "Account temporarily locked. Please try again later.",
    });
  }

  await existingUser.save();
  return res.status(401).json({ message: "Invalid email or password" });
});

const loginWithGoogle = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential || !process.env.GOOGLE_CLIENT_ID) {
    res.status(400);
    throw new Error("Google sign-in is not configured.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const googleUser = ticket.getPayload();

  if (!googleUser?.sub || !googleUser.email || !googleUser.email_verified) {
    res.status(401);
    throw new Error("Google account could not be verified.");
  }

  let user = await User.findOne({
    $or: [{ googleId: googleUser.sub }, { email: googleUser.email }],
  });

  if (!user) {
    user = await User.create({
      username: googleUser.name || googleUser.email.split("@")[0],
      email: googleUser.email,
      password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
      googleId: googleUser.sub,
    });
  } else if (!user.googleId) {
    user.googleId = googleUser.sub;
    await user.save();
  }

  createToken(res, user._id);
  res.status(200).json({
    _id: user._id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
  });
});

const logoutCurrentUser = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ message: "Logged out successfully" });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

const getCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
    });
  } else {
    res.status(404);
    throw new Error("User not found.");
  }
});

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      user.password = hashedPassword;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const deleteUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.isAdmin) {
      res.status(400);
      throw new Error("Cannot delete admin user");
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: "User removed" });
  } else {
    res.status(404);
    throw new Error("User not found.");
  }
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const updateUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.isAdmin = Boolean(req.body.isAdmin);

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

export {
  createUser,
  loginUser,
  loginWithGoogle,
  logoutCurrentUser,
  getAllUsers,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  deleteUserById,
  getUserById,
  updateUserById,
};
