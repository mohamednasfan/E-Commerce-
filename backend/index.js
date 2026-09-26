// packages
import path from "path";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Utils
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();
const port = process.env.PORT || 5000;

connectDB();

const app = express();
app.disable("x-powered-by");

// ============================================================
// 1) SHARED XSS / CSP HARDENING MIDDLEWARE (Teammate's part)
// Runs FIRST so Helmet (below) can override conflicting headers.
// ============================================================
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "img-src 'self' https:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https:",
      "font-src 'self' https: data:",
      "connect-src 'self' https:",
    ].join("; ")
  );
  next();
});

// ============================================================
// 2) MISSING SECURITY HEADERS (Your part)
// Helmet runs AFTER the shared middleware so its values take
// precedence for X-Frame-Options and Referrer-Policy.
// ============================================================
app.use(
  helmet({
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  })
);

// ============================================================
// Body parsers + query parser hardening
// ============================================================
app.set("query parser", "simple");

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ============================================================
// Routes
// ============================================================
app.use("/api/users", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/config/paypal", (req, res) => {
  res.send({ clientId: process.env.PAYPAL_CLIENT_ID });
});

const __dirname = path.resolve();
app.use("/uploads", express.static(path.join(__dirname + "/uploads")));

// ============================================================
// Sensitive Error Disclosure fix — centralized error handling
// ============================================================
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => console.log(`Server running on port: ${port}`));