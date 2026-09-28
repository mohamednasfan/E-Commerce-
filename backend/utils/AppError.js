// sensitive error disclosure - custom operational error class to distinguish safe user-facing errors from raw internal server exceptions
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
     // sensitive error disclosure - marks error as operational so errorHandler can safely send message without leaking stack traces
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
