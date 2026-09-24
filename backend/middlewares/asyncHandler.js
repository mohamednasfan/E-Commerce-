//SED= Wraps async route handlers so thrown errors are passed to Express's error middleware.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
