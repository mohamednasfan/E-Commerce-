import dotenv from "dotenv";
import AppError from "../utils/AppError.js";

dotenv.config();

const isDev = () => process.env.NODE_ENV === "development";

function mapKnownLibraryError(err) {
  if (err.name === "CastError") {
    return new AppError("Invalid ID format", 400);
  }

  if (err.name === "ValidationError") {
    return new AppError("Invalid request data", 400);
  }

  if (err.code === 11000) {
    return new AppError("Duplicate value already exists", 400);
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return new AppError("Not authorized", 401);
  }

  if (err.name === "MulterError") {
    return new AppError("File upload failed", 400);
  }

  if (err.type === "entity.parse.failed") {
    return new AppError("Invalid JSON payload", 400);
  }

  return null;
}

function looksLikeInternalDetail(message = "") {
  return /at\s+\S+\s+\(|Cast to ObjectId|E11000|MongoServerError|ValidationError|path `|mongodb(\+srv)?:\/\/|ENOENT|ECONNREFUSED|stack/i.test(
    message
  );
}

function getClientMessage(err, statusCode) {
  if (err.isOperational) {
    return err.message;
  }

  if (isDev()) {
    return err.message || "Internal server error";
  }

  if (statusCode >= 500 || looksLikeInternalDetail(err.message)) {
    return statusCode >= 500 ? "Internal server error" : "Bad request";
  }

  return err.message || "Bad request";
}

export const notFound = (req, res, next) => {
  next(new AppError("Resource not found", 404));
};

// fix sensitive error disclosure: "sanitizes error details and hides stack traces and database internal messages from client responses"
export const errorHandler = (err, req, res, next) => {
  const mapped = mapKnownLibraryError(err) || err;

  let statusCode = mapped.statusCode || res.statusCode;
  if (!statusCode || statusCode === 200) {
    statusCode = 500;
  }

  console.error(err);

  const message = getClientMessage(mapped, statusCode);
  const payload = { message, error: message };

  

  res.status(statusCode).json(payload);
};
