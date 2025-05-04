// backend/routes/userRoutes.js
const express = require('express');
const admin = require('firebase-admin');
const { body, validationResult } = require('express-validator');
// NOTE: Assuming authMiddleware is applied in server.js app.use('/api/user', authMiddleware, ...)
// If not, you MUST uncomment it here for routes that need protection.
// const authMiddleware = require('./authMiddleware');

// --- Configuration for Profile Picture Upload ---
const multer = require('multer');
console.log("--- DEBUG (userRoutes): Configuring Multer ---");
// Configure multer for memory storage (safer for PaaS like Render)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage, // Use memory storage
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit - adjust if needed
    fileFilter: (req, file, cb) => { // Basic image type filter
        console.log(`--- DEBUG (userRoutes): Multer fileFilter checking file: ${file.originalname}, mimetype: ${file.mimetype}`);
        if (file.mimetype.startsWith('image/')) {
            console.log("--- DEBUG (userRoutes): Multer fileFilter PASSED.");
            cb(null, true); // Accept file
        } else {
            console.warn("--- DEBUG (userRoutes): Multer fileFilter FAILED. Invalid type.");
            // Reject file - create an error object for the handler
            cb(new Error('Invalid file type: Only images (JPEG, PNG, GIF, etc.) are allowed.'), false);
        }
    },
});
// --- End Upload Config ---

const router = express.Router();
console.log("--- DEBUG (userRoutes): userRoutes.js file loaded and router created ---");

// Helper Middleware for Input Validation Errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn(`--- DEBUG (userRoutes): Validation Errors (${req.method} ${req.originalUrl}):`, errors.array());
        // Return only the message of the first error for simplicity
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next(); // Proceed if no validation errors
};

// --- Route to Update Display Name ---
const updateProfileRules = [
    body('displayName')
        .trim()
        .notEmpty().withMessage('Display name cannot be empty.')
        .isLength({ min: 3, max: 50 }).withMessage('Display name must be between 3 and 50 characters.')
        .escape(), // Prevent basic XSS attacks
];

console.log("--- DEBUG (userRoutes): Defining PUT /profile route ---");
// Path is relative to '/api/user' mount point in server.js
router.put(
    '/profile',
    // authMiddleware, // Assuming applied before these routes in server.js
    updateProfileRules, // Apply validation rules
    handleValidationErrors, // Handle any validation errors
    async (req, res, next) => {
        // Log entry into the main handler logic
        console.log(`--- DEBUG (userRoutes): Handler entered for PUT /api/user/profile. User authenticated: ${req.user ? 'Yes (UID: ' + req.user.uid + ')' : 'NO!'}`);

        // Defensive check for user object (should be populated by authMiddleware)
        if (!req.user || !req.user.uid) {
             console.error("CRITICAL ERROR (userRoutes): User details (req.user.uid) missing in PUT /profile handler! Check authMiddleware application in server.js.");
             return res.status(401).json({ error: "Authentication details missing or invalid."}); // Use 401 Unauthorized
        }
        const { uid } = req.user;
        const { displayName } = req.body;
        console.log(`--- DEBUG (userRoutes): Request body for PUT /profile:`, { displayName }); // Log input

        try {
            console.log(`--- DEBUG (userRoutes): Attempting Firebase Auth displayName update for UID: ${uid} with name: "${displayName}"`);
            // Perform the update operation on Firebase Authentication
            const updatedUserRecord = await admin.auth().updateUser(uid, {
                displayName: displayName
            });
            console.log(`--- DEBUG (userRoutes): Firebase Auth displayName update successful for UID: ${uid}.`);

            // Optional: If you also store profile info in Firestore, update it here.
            // Example: await admin.firestore().collection('users').doc(uid).update({ displayName });

            console.log(`SUCCESS (userRoutes): User ${uid} updated displayName to: "${displayName}"`);
            // Send a success response back to the client
            res.status(200).json({
                message: 'Profile display name updated successfully.',
                // Send back the updated part of the user profile
                user: { displayName: updatedUserRecord.displayName, uid: uid }
            });

        } catch (error) {
            console.error(`ERROR (userRoutes): Failed during PUT /api/user/profile for UID: ${uid}. Error:`, error);
            // Log specific Firebase error code if available
            if (error.code) console.error(`--- DEBUG (userRoutes): Firebase Error Code: ${error.code}`);
            // Pass the error to the global error handler in server.js
            next(error);
        }
    }
);


// --- Route for Profile Picture Upload ---
console.log("--- DEBUG (userRoutes): Defining POST /profile-picture route ---");
router.post(
    '/profile-picture',
    // authMiddleware, // Assuming applied before these routes in server.js
    (req, res, next) => { // Add log BEFORE multer runs
        console.log(`--- DEBUG (userRoutes): Request received for POST /api/user/profile-picture. User authenticated: ${req.user ? 'Yes (UID: ' + req.user.uid + ')' : 'NO!'}. Applying Multer...`);
        next();
    },
    upload.single('profilePic'), // Multer middleware: 'profilePic' MUST match FormData key from frontend
    (err, req, res, next) => { // Custom Multer error handler middleware
        // This specifically catches errors generated BY Multer (upload limits, file filter)
        if (err instanceof multer.MulterError) {
             console.warn(`--- DEBUG (userRoutes): Multer error caught for POST /profile-picture (User: ${req.user?.uid}). Code: ${err.code}, Message: ${err.message}`);
             if (err.code === 'LIMIT_FILE_SIZE') {
                 return res.status(400).json({ error: 'File is too large. Maximum size allowed is 5MB.' });
             }
             // Handle other potential Multer errors generically
            return res.status(400).json({ error: `File upload error: ${err.message}` });
        } else if (err) {
            // Handle errors thrown by the fileFilter
            console.warn(`--- DEBUG (userRoutes): Non-Multer upload error caught for POST /profile-picture (User: ${req.user?.uid}):`, err.message);
            // Send the specific error message from the fileFilter (e.g., "Invalid file type...")
            return res.status(400).json({ error: err.message || 'Invalid file or upload error.' });
        }
        // If no errors from Multer or fileFilter, proceed to the main route handler
        console.log(`--- DEBUG (userRoutes): Multer middleware passed for POST /profile-picture (User: ${req.user?.uid}). File in req.file: ${!!req.file}`);
        next();
    },
    async (req, res, next) => {
        // Main handler logic, runs only if Multer processing was successful
        console.log(`--- DEBUG (userRoutes): Handler entered for POST /api/user/profile-picture. User authenticated: ${req.user ? 'Yes (UID: ' + req.user.uid + ')' : 'NO!'}`);

        // Double-check authentication details again
        if (!req.user || !req.user.uid) {
             console.error("CRITICAL ERROR (userRoutes): User details (req.user.uid) missing in POST /profile-picture handler! Check authMiddleware application.");
             return res.status(401).json({ error: "Authentication details missing or invalid."});
         }
        const { uid } = req.user;

        // Check if a file was actually uploaded and processed by Multer
        if (!req.file) {
            console.log("--- DEBUG (userRoutes): No file found in req.file for POST /profile-picture ---");
            // This might happen if the frontend field name doesn't match 'profilePic'
            return res.status(400).json({ error: 'No profile picture file was uploaded or processed.' });
        }
        console.log(`--- DEBUG (userRoutes): File received: ${req.file.originalname}, Size: ${req.file.size}, Mimetype: ${req.file.mimetype}`);

        try {
            console.log(`--- DEBUG (userRoutes): Setting up Firebase Storage upload for user ${uid}, filename: ${req.file.originalname}`);
            // Get the storage bucket reference (bucket name comes from server.js initialization)
            const bucket = admin.storage().bucket();
            if (!bucket.name) {
                 console.error("CRITICAL ERROR (userRoutes): Firebase Storage bucket name is not configured! Check FIREBASE_STORAGE_BUCKET env var and server.js initialization.");
                 throw new Error("Storage bucket configuration error."); // Throw error to be caught below
            }
            console.log(`--- DEBUG (userRoutes): Using storage bucket: ${bucket.name}`);

            // Create a unique filename to prevent overwrites and collisions
            const timestamp = Date.now();
            // Sanitize filename: replace spaces with underscores
            const sanitizedOriginalName = req.file.originalname.replace(/\s+/g, '_');
            const fileName = `profile-pictures/${uid}/${timestamp}-${sanitizedOriginalName}`; // Define path in the bucket
            const fileUpload = bucket.file(fileName); // Get a reference to the file object in the bucket

            console.log(`--- DEBUG (userRoutes): Creating write stream for Firebase Storage file: ${fileName}`);
            // Create a write stream to upload the file buffer from memory
            const stream = fileUpload.createWriteStream({
                 metadata: {
                     contentType: req.file.mimetype, // Set the correct Content-Type for the uploaded file
                 },
                 resumable: false // Simpler uploads, better for smaller files
             });

            // --- Stream Event Handlers ---

            stream.on('error', (err) => {
                 // Handle errors during the upload stream process
                 console.error(`ERROR (userRoutes): Stream error during profile picture upload for ${uid}, file ${fileName}. Error:`, err);
                 // Pass a new error to the global handler, indicating stream failure
                 next(new Error('Failed during the image upload process. Please try again.'));
                 // Note: Don't try to send a response here as headers might already be sent or stream closed abruptly.
            });

            stream.on('finish', async () => {
                // This event fires when the upload to Firebase Storage is complete
                console.log(`--- DEBUG (userRoutes): File upload stream finished successfully for ${uid}, filename: ${fileName}.`);
                try {
                    console.log(`--- DEBUG (userRoutes): Attempting to make file public: ${fileName}`);
                    // Make the uploaded file publicly accessible
                    await fileUpload.makePublic();
                    // Construct the public URL (standard format for GCS)
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    console.log(`--- DEBUG (userRoutes): File made public. URL: ${publicUrl}. Attempting to update Firebase Auth photoURL for UID: ${uid}`);

                    // Update the user's profile in Firebase Authentication with the new photo URL
                    const updatedUserRecord = await admin.auth().updateUser(uid, {
                         photoURL: publicUrl
                     });
                    console.log(`--- DEBUG (userRoutes): Firebase Auth photoURL update successful for UID: ${uid}.`);

                    // Optional: Update Firestore record if needed
                    // Example: await admin.firestore().collection('users').doc(uid).update({ photoURL: publicUrl });

                    console.log(`SUCCESS (userRoutes): User ${uid} updated photoURL to: ${publicUrl}`);
                    // Send the success response with the new URL
                    res.status(200).json({
                        message: 'Profile picture updated successfully.',
                        user: { photoURL: updatedUserRecord.photoURL, uid: uid } // Send back updated info
                    });

                } catch (finalizeError) {
                    // Catch errors during makePublic() or admin.auth().updateUser()
                    console.error(`ERROR (userRoutes): Failed during finalization (makePublic/Auth update) for ${uid}, file ${fileName}. Error:`, finalizeError);
                    // Pass a specific error message to the global handler
                    next(new Error('Upload complete, but failed to update profile with the new picture URL.'));
                }
            });

            // --- End Stream Event Handlers ---

            // Start the upload by writing the file buffer (from memory) to the stream
            console.log(`--- DEBUG (userRoutes): Ending stream to start upload for ${uid}, file ${fileName}.`);
            stream.end(req.file.buffer);

        } catch (setupError) {
             // Catch errors during the initial setup (getting bucket, creating file reference, etc.)
             console.error(`ERROR (userRoutes): Failed during setup phase of profile picture upload for user ${uid}. Error:`, setupError);
             next(setupError); // Pass the error to the global handler
        }
    }
);


// --- Password Change Reminder ---
// Password changes are typically handled securely on the FRONTEND using the Firebase Client SDK's
// `reauthenticateWithCredential` and `updatePassword` methods. Avoid sending passwords to the backend.

console.log("--- DEBUG (userRoutes): userRoutes.js setup complete. Exporting router. ---");
module.exports = router;