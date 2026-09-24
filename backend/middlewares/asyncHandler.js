const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    // Preserve a status already set by the controller (e.g. res.status(401)),
    // otherwise default to 500. Without this, `res.status(401); throw ...`
    // would incorrectly surface as 500.
    const statusCode =
      res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({ message: error.message });
  });
};

export default asyncHandler;
