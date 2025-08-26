export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Set CORS headers
  const corsOrigin = process.env.CORS_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-csrf-token"
  );

  res.status(statusCode).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
};
