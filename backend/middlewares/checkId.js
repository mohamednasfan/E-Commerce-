import { isValidObjectId } from "mongoose";

function checkId(req, res, next) {
  if (typeof req.params.id !== "string" || !isValidObjectId(req.params.id)) {
    res.status(404);
    throw new Error("Invalid Object Id");
  }
  next();
}

export default checkId;
