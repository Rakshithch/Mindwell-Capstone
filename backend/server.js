// backend/server.js
// Updated: Increased body limits, verified route mounting and logging.

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");
const fs = require('fs');
require("dotenv").config(); // Load environment variables first

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// --- Import Middleware & Route Handlers ---
console.log("--- DEBUG (Server): Importing middleware & routes ---");
const authMiddleware = require('./routes/authMiddleware'); // Authentication middleware
const letterRoutes = require("./routes/anonymousLetters"); // Anonymous letters routes
const facilityRoutes = require("./routes/facilities");     // Facilities routes (assuming public)
const wellnessFeedRoutes = require("./routes/wellnessFeed"); // Wellness feed routes (assuming public)
const aiChatRoutes = require('./routes/aiChatRoutes');      // AI chat routes (protected)
const userRoutes = require('./routes/userRoutes');          // User profile routes (protected)
console.log("--- DEBUG (Server): Imports complete ---");
// --- End Imports ---

const app = express();
console.log("--- DEBUG (Server): Express app initialized ---");

// --- Security Enhancements ---
// Apply various security headers (Content Security Policy, XSS protection, etc.)
app.use(helmet());
console.log("--- DEBUG (Server): Helmet security headers applied ---");

// --- CORS Configuration ---
// Define allowed origins based on the environment
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL_PROD ? [process.env.FRONTEND_URL_PROD] : []) // Use specific Render frontend URL in prod
    : ["http://localhost:3000", "http://localhost:8081", "http://localhost:8082", "https://mindwell-frontend.onrender.com"]; // Allow common local ports + deployed frontend for dev

console.log(`--- INFO (Server): NODE_ENV=${process.env.NODE_ENV}. Allowed CORS Origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'NONE (Check FRONTEND_URL_PROD in prod!)'}`);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g., server-to-server, mobile apps, curl) OR from whitelisted origins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true); // Allow
        } else {
            console.warn(`CORS Blocked: Request from origin "${origin}" is not allowed.`);
            callback(new Error(`Origin "${origin}" not allowed by CORS policy.`)); // Block
        }
    },
    methods: "GET, POST, DELETE, PUT, OPTIONS", // Specify allowed HTTP methods
    allowedHeaders: "Content-Type, Authorization", // Specify allowed request headers (Authorization is crucial)
    credentials: true // Allow sending cookies or authorization headers from the frontend
};
app.use(cors(corsOptions)); // Apply CORS middleware with options
app.options('*', cors(corsOptions)); // IMPORTANT: Enable pre-flight requests for all routes
console.log("--- DEBUG (Server): CORS configured and applied ---");

// --- Rate Limiting ---
// Apply a rate limiter to all API routes to prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes duration
    max: 150, // Limit each IP to 150 requests per windowMs (adjust as needed)
    message: { error: "Too many requests received from this IP address. Please try again after 15 minutes." },
    standardHeaders: true, // Send standard RateLimit-* headers
    legacyHeaders: false, // Disable older X-RateLimit-* headers
});
app.use('/api/', apiLimiter); // Apply limiter specifically to routes under /api/
console.log("--- DEBUG (Server): Rate limiter applied to /api/ routes ---");

// --- Body Parsers ---
// Parse incoming JSON request bodies
// Increased limit for potentially larger non-file data, though file uploads are handled by Multer
app.use(express.json({ limit: '10mb' }));
// Parse incoming URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
console.log("--- DEBUG (Server): Body parsers (JSON & URL-encoded) applied with 10mb limit ---");

// --- Request Logging Middleware ---
// Log basic details for every incoming request
app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => { // Log when the response is finished sending
        const duration = Date.now() - startTime;
        // Log method, URL, status code, and response time
        console.log(`ACCESS LOG: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} [${duration}ms]`);
    });
    next(); // Pass control to the next middleware
});
console.log("--- DEBUG (Server): Request access logger applied ---");


// --- Firebase Admin Initialization ---
console.log("--- DEBUG (Server): Initializing Firebase Admin SDK ---");
try {
    let serviceAccount;
    // Prioritize environment variable for service account JSON (best for Render)
    const serviceAccountEnvVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    // Fallback path for local development
    const serviceAccountPath = path.join(__dirname, "firebaseServiceAccount.json");

    if (serviceAccountEnvVar) {
        console.log("--- INFO (Server): Attempting Firebase Admin Init from Environment Variable (FIREBASE_SERVICE_ACCOUNT_JSON)...");
        try {
             // Parse the JSON string from the environment variable
             serviceAccount = JSON.parse(serviceAccountEnvVar);
             console.log("--- DEBUG (Server): Successfully parsed FIREBASE_SERVICE_ACCOUNT_JSON.");
        } catch (e) {
            console.error("CRITICAL ERROR (Server): Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Ensure it's valid JSON string in env vars.", e.message);
            throw e; // Re-throw parsing error to halt initialization
        }
    } else if (fs.existsSync(serviceAccountPath)) {
        // Use local file only if environment variable is not set (for local dev)
        console.log("--- INFO (Server): Initializing Firebase Admin SDK from local file (firebaseServiceAccount.json) - FOR LOCAL DEV ONLY ---");
        serviceAccount = require(serviceAccountPath);
    } else {
        // If neither method works, it's a critical configuration error
        throw new Error("Firebase Admin SDK credentials configuration error. Set FIREBASE_SERVICE_ACCOUNT_JSON env var for production, or place firebaseServiceAccount.json in backend root for local development.");
    }

    // Get Storage Bucket name from Environment Variable (CRITICAL for uploads)
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET; // e.g., your-project-id.appspot.com
    if (!storageBucket) {
        // Log a warning if missing, especially important in production
        console.warn("CONFIGURATION WARNING (Server): FIREBASE_STORAGE_BUCKET environment variable is NOT SET! Firebase Storage operations (like profile picture uploads) will likely fail.");
        // Consider throwing an error in production if storage is essential:
        // if (process.env.NODE_ENV === 'production') throw new Error("FIREBASE_STORAGE_BUCKET must be set in production environment!");
    } else {
         console.log(`--- INFO (Server): Firebase Storage Bucket configured: ${storageBucket}`);
    }

    // Initialize the Firebase Admin App
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount), // Use parsed or required credentials
        storageBucket: storageBucket // Use the bucket name from the environment variable
    });

    console.log(`✅ SUCCESS (Server): Firebase Admin SDK Initialized Successfully.`);

} catch (error) {
    // Catch any error during the initialization process
    console.error("❌ CRITICAL STARTUP ERROR (Server): Firebase Admin SDK Initialization Failed:", error.message || error);
    // Exit the process with a failure code - the app cannot run without Firebase Admin
    process.exit(1);
}

// --- Mount API Routes ---
console.log("--- DEBUG (Server): Mounting API Routes ---");

// --- Public Routes (No Authentication Required) ---
console.log("--- DEBUG (Server): Mounting PUBLIC route /api/facilities ---");
app.use("/api/facilities", facilityRoutes); // Example: finding nearby facilities
console.log("--- DEBUG (Server): Mounting PUBLIC route /api/wellness-feed ---");
app.use("/api/wellness-feed", wellnessFeedRoutes); // Example: news feed
console.log("--- DEBUG (Server): Mounting PUBLIC route /api/anonymous-letters ---");
// Note: letterRoutes internal logic handles auth for POST/PUT/DELETE, GET is public
app.use("/api/anonymous-letters", letterRoutes); // Forum letters

// --- Protected Routes (Authentication Required) ---
// Apply authMiddleware BEFORE the specific route handlers for these sections
console.log("--- DEBUG (Server): Mounting PROTECTED route /api/ai-chat ---");
app.use("/api/ai-chat", authMiddleware, aiChatRoutes); // AI assistant requires login
console.log("--- DEBUG (Server): Mounting PROTECTED route /api/user ---");
app.use('/api/user', authMiddleware, userRoutes); // User profile management requires login

console.log("--- DEBUG (Server): API Route mounting complete ---");
// --- End API Routes ---

// --- Basic Root and Health Check Routes ---
// Simple welcome message for the API root
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Welcome to the MindWell API! Stay Positive, Stay Healthy.",
        status: "Running",
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
     });
});

// Standard health check endpoint used by Render and other services
app.get("/healthz", (req, res) => {
    res.status(200).send("OK"); // Simple OK response indicates the server is up
});
console.log("--- DEBUG (Server): Root ('/') and Health ('/healthz') routes mounted ---");

// --- Centralized Error Handling ---
// 404 Handler: Catch requests for routes that don't exist
console.log("--- DEBUG (Server): Mounting 404 (Not Found) handler ---");
app.use((req, res, next) => {
    // Log the request that triggered the 404
    console.log(`--- DEBUG (Server): 404 Not Found triggered for ${req.method} ${req.originalUrl} ---`);
    // Send a standard 404 response
    res.status(404).json({ error: `The requested resource was not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler: Catches errors passed via next(err) from route handlers or middleware
console.log("--- DEBUG (Server): Mounting Global Error Handler ---");
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // Log the full error stack trace for detailed debugging
    console.error("💥 UNHANDLED ERROR DETECTED by Global Handler:", err.stack || err);

    // Determine appropriate status code: use error's status or default to 500
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500; // Default to Internal Server Error

    // Determine response message: show details in dev, generic message in prod unless explicitly safe
    const message = (process.env.NODE_ENV !== 'production' || err.expose === true)
         ? err.message || "An unexpected error occurred." // Use error message or a default
         : "An internal server error occurred. Please try again later."; // Generic message for production

    // Send the JSON error response
    res.status(statusCode).json({
        error: message,
        // Optionally include stack trace in development environments for easier debugging
        ...(process.env.NODE_ENV === 'development' && { stack_trace: err.stack }),
    });
});
console.log("--- DEBUG (Server): Error handling middleware mounted ---");
// --- End Error Handling ---

// --- Start the Server ---
// Use the port provided by Render's environment variable, or fallback for local dev
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    // Server startup confirmation logs
    console.log(`\n🚀 MindWell Backend Server is running and listening on port ${PORT}`);
    console.log(`      Mode:               ${process.env.NODE_ENV || 'development'}`);
    console.log(`      Allowed Origins:    ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'NONE CONFIGURED!'}`);
    if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL_PROD) {
        console.warn('      WARNING: Production mode detected, but FRONTEND_URL_PROD environment variable is missing!');
    }
    console.log(`      News API Key:       ${process.env.NEWS_API_KEY ? 'Loaded' : 'NOT SET!'}`);
    console.log(`      Google AI API Key:  ${process.env.GOOGLE_API_KEY ? 'Loaded' : 'NOT SET!'}`); // Assuming key name
    const firebaseCredSource = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'ENV Variable' : (fs.existsSync(path.join(__dirname, "firebaseServiceAccount.json")) ? 'Local File (Dev Only)' : 'NOT FOUND!');
    console.log(`      Firebase Creds:     ${firebaseCredSource}`);
    if (firebaseCredSource === 'NOT FOUND!') console.error('      CRITICAL ERROR: Firebase credentials configuration missing!');
    console.log(`      Firebase Storage:   ${process.env.FIREBASE_STORAGE_BUCKET || 'NOT SET!'}`);
    if (!process.env.FIREBASE_STORAGE_BUCKET) console.warn('      WARNING: Firebase Storage Bucket is not set! Uploads will fail.');
    console.log("--- INFO (Server): Startup sequence complete. Awaiting requests... ---");
});