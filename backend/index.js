// packages
import path from "path";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Utiles
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
//Missing Security Header= Sets security headers to protect the app from common web attacks.
const app = express();
app.disable("x-powered-by");

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// XSS/containment hardening (helmet-equivalent, zero-dependency):
// Even though the React frontend escapes via JSX, stored payloads could
// execute in other consumers. CSP + nosniff + frame guard limits impact.
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

// Defense-in-depth: use simple query parser so ?keyword[$gt]= stays a
// literal string instead of becoming {keyword:{$gt:""}} via qs nesting.
app.set("query parser", "simple");

app.use(express.json({ limit: "100kb" }));
// NoSQL hardening: extended:false avoids qs nesting (field[$ne]=) in urlencoded bodies.
// JSON bodies are still strictly type-checked in controllers.
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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

// fix sensitive error disclosure: "centralized error handler prevents unhandled server errors from leaking stack traces"
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => console.log(`Server running on port: ${port}`));
