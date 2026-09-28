// fix sensitive error disclosure: "forwards async route errors to central error handler instead of exposing raw error messages"
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
