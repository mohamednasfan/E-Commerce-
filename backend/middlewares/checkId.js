import { isValidObjectId } from "mongoose";
import AppError from "../utils/AppError.js";

function checkId(req, res, next) {
  // fix sensitive error disclosure: "validates Object ID format upfront to prevent database CastError stack trace leakage"
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError("Invalid ID format", 400));
  }
  next();
}

export default checkId;
