// backend/server.js
// Final Corrected Version: Includes storageBucket init, userRoutes mounting, correct rate limiter placement, and CORS trailing slash fix.

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");
const fs = require('fs');
require("dotenv").config(); // Load environment variables early

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// --- Step 1: Import Middleware & Route Handlers ---
console.log("--- DEBUG: Importing middleware & routes ---");
const authMiddleware = require('./routes/authMiddleware');
const letterRoutes = require("./routes/anonymousLetters");
const facilityRoutes = require("./routes/facilities");
const wellnessFeedRoutes = require("./routes/wellnessFeed");
const aiChatRoutes = require('./routes/aiChatRoutes');
const userRoutes = require('./routes/userRoutes'); // Import user routes
console.log("--- DEBUG: Imports complete ---");

// --- End Imports ---

const app = express();
console.log("--- DEBUG: Express app initialized ---");

// --- Security Enhancements ---
app.use(helmet()); // Apply security headers
console.log("--- DEBUG: Helmet applied ---");

// --- CORS Configuration ---
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL_PROD ? [process.env.FRONTEND_URL_PROD] : []) // Use configured prod URL
    : ["http://localhost:3000", "http://localhost:8082", "http://localhost:8003", "http://localhost:8081", "https://mindwell-capstone-f.onrender.com"]; // Dev origins

const corsOptions = {
    origin: function (origin, callback) {
        // --- MODIFIED: Handle potential trailing slash ---
        const originWithoutSlash = origin ? origin.replace(/\/$/, '') : origin; // Remove trailing slash if present

        // Allow requests with no origin OR from allowed origins (check both forms just in case)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes(originWithoutSlash)) {
            callback(null, true); // Allow
        } else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('This origin is not allowed by CORS policy.')); // Block
        }
        // --- END MODIFICATION ---
    },
    methods: "GET, POST, DELETE, PUT, OPTIONS", // Allowed HTTP methods
    allowedHeaders: "Content-Type, Authorization", // Allowed headers in requests
    credentials: true // Allow cookies/authorization headers
};
app.use(cors(corsOptions)); // Apply CORS middleware
app.options('*', cors(corsOptions)); // Enable pre-flight requests for all routes
console.log("--- DEBUG: CORS configured ---");

// --- Rate Limiting ---
// Apply rate limiter generally to all routes starting with /api/
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 150, // Max requests per IP per windowMs
    message: { error: "Too many requests from this IP, please try again after 15 minutes." },
    standardHeaders: true, // Send standard RateLimit-* headers
    legacyHeaders: false, // Disable old X-RateLimit-* headers
});
app.use('/api/', apiLimiter); // Apply limiter to all /api/ routes
console.log("--- DEBUG: Rate limiter applied to /api/ ---");

// --- Body Parsers ---
// Parse JSON bodies (limit size for security)
app.use(express.json({ limit: '20kb' }));
// Parse URL-encoded bodies (limit size)
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
console.log("--- DEBUG: Body parsers applied ---");

// --- Request Logging Middleware ---
// Logs basic info for every incoming request
app.use((req, res, next) => {
    const startTime = Date.now();
    // Log details when the response finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`REQ: ${req.method} ${req.originalUrl} - STATUS ${res.statusCode} [${duration}ms]`);
    });
    next(); // Pass control to the next middleware
});
console.log("--- DEBUG: Request logger applied ---");


// --- Firebase Admin Initialization ---
console.log("--- DEBUG: Initializing Firebase Admin SDK ---");
try {
    let serviceAccount;
    const serviceAccountEnvVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = path.join(__dirname, "firebaseServiceAccount.json"); // Assumes file is in backend root

    if (serviceAccountEnvVar) {
        console.log("--- DEBUG: Init Firebase Admin SDK from Environment Variable...");
        try {
             serviceAccount = JSON.parse(serviceAccountEnvVar);
        } catch (e) {
            console.error("ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
            throw e; // Re-throw parsing error
        }
    } else if (fs.existsSync(serviceAccountPath)) {
        console.log("--- DEBUG: Init Firebase Admin SDK from local file (firebaseServiceAccount.json)...");
        serviceAccount = require(serviceAccountPath);
    } else {
        // Critical error if no credentials found
        throw new Error("Firebase Admin SDK credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON env var or place firebaseServiceAccount.json in backend root.");
    }

    // Initialize Firebase Admin App with credentials AND storage bucket name
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Replace with your actual bucket name (without gs://)
        storageBucket: "mindwell-1f2fe.firebasestorage.app"
    });

    console.log("✅ Firebase Admin SDK Initialized Successfully (including Storage Bucket config).");

} catch (error) {
    // Log critical initialization error and exit the process
    console.error("❌ CRITICAL ERROR: Firebase Admin SDK Initialization Failed:", error.message || error);
    process.exit(1); // Exit with failure code
}


// --- Step 2: Mount ALL API Routes ---
console.log("--- DEBUG: Mounting API Routes ---");

// Public routes
console.log("--- DEBUG: Mounting /api/facilities ---");
app.use("/api/facilities", facilityRoutes);
console.log("--- DEBUG: Mounting /api/wellness-feed ---");
app.use("/api/wellness-feed", wellnessFeedRoutes);
console.log("--- DEBUG: Mounting /api/anonymous-letters ---");
app.use("/api/anonymous-letters", letterRoutes);

// Protected routes
console.log("--- DEBUG: Mounting /api/ai-chat ---");
app.use("/api/ai-chat", authMiddleware, aiChatRoutes);

// USER ROUTES MOUNTING
console.log("--- DEBUG: Attempting to mount /api/user ---");
app.use('/api/user', authMiddleware, userRoutes);
console.log("--- DEBUG: Successfully mounted /api/user ---");

// --- End API Routes ---

// --- Simple Root Route ---
app.get("/", (req, res) => { res.status(200).json({ message: "Welcome to the MindWell API! Stay Positive, Stay Healthy." }); });

// --- Health Check Route ---
app.get("/healthz", (req, res) => { res.status(200).send("OK"); });
console.log("--- DEBUG: Root and Health routes mounted ---");

// --- Step 3: Centralized Error Handling ---
// 404 Handler
console.log("--- DEBUG: Mounting 404 handler ---");
app.use((req, res, next) => {
    console.log(`--- DEBUG: 404 triggered for ${req.method} ${req.originalUrl} ---`);
    res.status(404).json({ error: `Resource Not Found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
console.log("--- DEBUG: Mounting global error handler ---");
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("💥 UNHANDLED ERROR DETECTED:", err.stack || err);
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    const message = (process.env.NODE_ENV !== 'production' || err.expose === true)
         ? err.message
         : "An unexpected internal server error occurred.";

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack_trace: err.stack }),
    });
});
// --- End Error Handling ---

// --- Start the Server ---
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`\n🚀 MindWell Server listening on port ${PORT}`);
    console.log(`      Mode: ${process.env.NODE_ENV || 'development'}`);
    if(Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
        console.log(`      Allowed CORS origins: ${allowedOrigins.join(', ')}`);
    } else if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL_PROD) {
        console.warn('      WARNING: Running in production mode, but FRONTEND_URL_PROD is not set in .env! CORS might block frontend.');
    } else if (process.env.NODE_ENV !== 'production') {
         console.log(`      Allowed CORS origins: Dev list specified`);
    } else {
         console.log('      Allowed CORS origins: None specified in production!');
    }
    console.log(`      News API Key Loaded: ${process.env.NEWS_API_KEY ? 'Yes' : 'NO!'}`);
    console.log(`      Google AI API Key Loaded: ${process.env.GOOGLE_API_KEY ? 'Yes' : 'NO!'}`);
    const firebaseCredSource = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'ENV Var' : (fs.existsSync(path.join(__dirname, "firebaseServiceAccount.json")) ? 'File' : 'NOT FOUND');
    console.log(`      Firebase Credentials Source: ${firebaseCredSource}`);
    if (firebaseCredSource === 'NOT FOUND') console.error('      ERROR: Firebase credentials could not be located!');
    console.log("--- DEBUG: Server startup sequence complete ---");
});