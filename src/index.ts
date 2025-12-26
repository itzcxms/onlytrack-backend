import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { registerRoutes } from "./routes";
import { testConnection } from "./db";

// Log startup
console.log("🚀 Starting Onlytrack Backend...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);

const app = express();

// CORS configuration - allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Test database connection
(async () => {
  try {
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error("⚠️ Database connection failed, but server will continue...");
    }
  } catch (error) {
    console.error("⚠️ Database connection test error:", error);
  }
})();

// Register all API routes
const server = registerRoutes(app);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Error:", message);
  res.status(status).json({ message });
});

// Start server
const port = parseInt(process.env.PORT || "5000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`✅ Backend server running on port ${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
});
