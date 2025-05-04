// backend/middleware/authMiddleware.js
// (Assuming it's in a 'middleware' folder, adjust path if needed)

const admin = require("firebase-admin"); // Ensure Firebase Admin SDK is initialized in server.js


const authMiddleware = async (req, res, next) => {
    // 1. Get the Authorization header. Use optional chaining for safety.
    const authHeader = req.headers?.authorization;

    // 2. Check if header exists and follows the 'Bearer <token>' scheme.
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        // Log this specific condition for easier debugging
        console.warn(`Auth Middleware: Missing or invalid Authorization header for ${req.method} ${req.originalUrl}`);
        return res.status(401).json({ error: "Unauthorized: Missing or improperly formatted token." });
    }

    // 3. Extract the ID token.
    const idToken = authHeader.substring(7); // More efficient than split(' ')[1]
    if (!idToken) {
         console.warn(`Auth Middleware: Extracted token is empty for ${req.method} ${req.originalUrl}`);
        // This case is less likely if startsWith('Bearer ') passed, but good safety check.
        return res.status(401).json({ error: "Unauthorized: Malformed token (empty)." });
    }

    // 4. Verify the token using Firebase Admin SDK within a try...catch block.
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // 5. Token is valid! Attach essential user info to the request object.
        // Ensure 'uid' is always present after successful verification.
        if (!decodedToken.uid) {
             // This should theoretically not happen if verifyIdToken succeeds, but good practice.
             console.error(`Auth Middleware: Decoded token is missing UID! Token details:`, decodedToken);
             throw new Error("Internal Server Error: Invalid token structure after verification.");
        }

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email || null, // Handle potentially missing email
            // Optionally add other useful fields if present in your tokens:
            // name: decodedToken.name || null,
            // picture: decodedToken.picture || null,
            // email_verified: decodedToken.email_verified || false,
        };

        // Optional: Log successful authentication (can be verbose)
        // console.log(`Auth Middleware: User Authenticated - UID: ${req.user.uid}`);

        // 6. Proceed to the next middleware or the actual route handler.
        next();

    } catch (error) {
        // 7. Handle token verification errors gracefully.
        console.error(`Auth Middleware: Token verification failed for ${req.method} ${req.originalUrl} - Code: ${error.code || 'N/A'}, Message: ${error.message}`);

        let statusCode = 401; // Default: Unauthorized
        let message = "Unauthorized: Invalid or expired token."; // Default message

        // Refine error messages based on common Firebase Auth error codes
        switch (error.code) {
            case 'auth/id-token-expired':
                message = "Unauthorized: Session token has expired. Please log in again.";
                // Optionally add a specific error code for the frontend:
                // return res.status(statusCode).json({ error: message, code: 'TOKEN_EXPIRED' });
                break;
            case 'auth/argument-error':
                message = "Unauthorized: Token verification failed due to an argument error.";
                // Could be 400 Bad Request if the token format itself was clearly wrong
                // statusCode = 400;
                break;
            case 'auth/user-disabled':
                message = "Forbidden: Your account has been disabled.";
                statusCode = 403; // Forbidden
                break;
            case 'auth/id-token-revoked':
                message = "Unauthorized: Session token has been revoked. Please log in again.";
                break;
            case 'auth/internal-error': // Catch potential internal Firebase errors
                 message = "Internal Server Error: Could not verify token due to a server issue.";
                 statusCode = 500;
                 break;
            default:
                // Check for network-related errors or other issues
                if (error.message && error.message.includes('Failed to fetch public keys')) {
                    message = 'Internal Server Error: Could not verify token due to a network issue contacting authentication servers.';
                    statusCode = 503; // Service Unavailable might be more appropriate
                } else if (error.message && error.message.includes('Invalid token structure')) {
                    // Catch the custom error thrown above if UID is missing post-verification
                    message = error.message;
                    statusCode = 500;
                }
                // Keep the default message for other unknown errors
                break;
        }

        return res.status(statusCode).json({ error: message });
    }
};

// Export the middleware function for use in server.js
module.exports = authMiddleware;