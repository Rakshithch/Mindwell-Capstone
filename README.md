# MindWell - Mental Wellness Support Platform

![MindWell Logo](./frontend/src/assets/Logo.webp) <!-- Adjust path if needed -->

MindWell is a web application designed to provide accessible tools and community support for mental wellness. It offers features for mood tracking, AI-driven guidance, anonymous sharing, finding local support, and curated wellness resources.

## ✨ Key Features

*   **Dashboard:** Log daily moods and journal entries; visualize mood history with a "Mood Constellation".
*   **AI Assistant:** Engage with a supportive chatbot for reflection, guidance, and coping strategies based on simple emotion detection.
*   **Community Letters:** Post thoughts anonymously and read/reply to letters from other users, fostering a supportive community. Features include liking and owner-only deletion.
*   **Find Support:** Locate nearby hospitals and clinics using an interactive map (powered by OpenStreetMap via Overpass API).
*   **Quick Relief:** Access guided exercises (like grounding, mindful breathing) for immediate support during moments of panic, anxiety, or overwhelm.
*   **Wellness Store:** Browse a curated list of wellness products (links to external e-commerce platform for purchase).
*   **Secure Authentication:** User registration and login via Firebase Authentication (Email/Password & Google Sign-In).

## 🛠️ Tech Stack

**Frontend:**

*   React (v18+)
*   React Router DOM (v6)
*   Firebase SDK (v9+ for Auth, Firestore)
*   Axios (for API calls)
*   Framer Motion (for animations)
*   React Leaflet & Leaflet (for Find Support map)
*   D3.js (for Mood Constellation visualization)
*   CSS (with CSS Variables for theming)
*   `react-firebase-hooks` (for easy auth state management)
*   `react-icons`

**Backend:**

*   Node.js
*   Express.js
*   Firebase Admin SDK (for secure backend operations - Auth verification, Firestore access)
*   Firestore (as the primary database)
*   Axios (for calling Overpass API)
*   `express-validator` (for input validation)
*   `cors` (for Cross-Origin Resource Sharing)
*   `helmet` (for basic security headers)
*   `dotenv` (for environment variables)
*   `express-rate-limit` (for basic API rate limiting)

## 📂 Project Structure
MENTALHEALTHAPPLICATION_BACKUP/
├── backend/
│ ├── node_modules/ (Ignored by git)
│ ├── routes/ # API route handlers (Express Routers)
│ │ ├── anonymousLetters.js
│ │ ├── authMiddleware.js
│ │ ├── chatbot.js
│ │ └── facilities.js
│ ├── utils/ # Helper functions
│ │ └── chatbotHelper.js
│ ├── .env # Environment variables (Ignored by git)
│ ├── .firebaserc
│ ├── .gitignore
│ ├── firebase.json
│ ├── firebaseServiceAccount.json # Firebase Admin credentials (Ignored by git)
│ ├── package-lock.json
│ ├── package.json
│ └── server.js # Main Express server setup
├── frontend/
│ ├── node_modules/ (Ignored by git)
│ ├── public/ # Static assets, index.html
│ │ ├── index.html
│ │ ├── manifest.json
│ │ └── ...
│ ├── src/
│ │ ├── assets/ # Images, icons, etc.
│ │ ├── components/ # Reusable React components
│ │ ├── pages/ # Page-level React components
│ │ ├── services/ # Firebase config, API helpers
│ │ ├── utils/ # Helper functions, static data
│ │ ├── App.css
│ │ ├── App.js # Main application component, routing
│ │ ├── index.css
│ │ ├── index.js # React entry point
│ │ └── reportWebVitals.js
│ ├── .env # Environment variables (Ignored by git)
│ ├── .gitignore
│ ├── package-lock.json
│ └── package.json
├── .gitignore # Root gitignore
└── README.md # This file

## 🚀 Getting Started

### Prerequisites

*   Node.js (LTS version recommended, e.g., v18+)
*   npm or yarn
*   Git
*   A Firebase Project (Create one at [https://console.firebase.google.com/](https://console.firebase.google.com/))

### Firebase Setup

1.  **Create Project:** Set up a new project in the Firebase console.
2.  **Enable Services:**
    *   Enable **Authentication:** Add Email/Password and Google sign-in methods.
    *   Enable **Firestore Database:** Start in production or test mode (configure security rules appropriately later).
3.  **Web App Registration (Frontend):**
    *   In your Firebase project settings, add a new "Web app".
    *   Copy the `firebaseConfig` object provided. You'll need these values for the frontend `.env` file.
4.  **Service Account Key (Backend):**
    *   In project settings > Service accounts, click "Generate new private key".
    *   Download the JSON file. **Rename it to `firebaseServiceAccount.json`**.
    *   Place this file inside the `backend/` directory. **DO NOT commit this file to Git.**

### Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Rakshithch/Mindwell-Capstone.git
    cd Mindwell
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    npm install
    ```
    *   Create a `.env` file in the `backend/` directory (see Environment Variables section below).
    *   Place your downloaded `firebaseServiceAccount.json` file in the `backend/` directory.

3.  **Frontend Setup:**
    ```bash
    cd ../frontend
    npm install
    ```
    *   Create a `.env` file in the `frontend/` directory (see Environment Variables section below). Add your Firebase web app config keys and other necessary keys.

### Environment Variables

You need to create `.env` files for both the backend and frontend. **These files should NOT be committed to Git.** Create `.env.example` files to show required variables.

**1. `backend/.env`:**

```env
# Port for the backend server
PORT=8081

# Optional: Frontend URL for CORS in production
# FRONTEND_URL_PROD=https://your-deployed-frontend.com

# Add any other backend-specific API keys if needed
# Firebase Web App Configuration (Get these from Firebase Console)
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=1:...:web:...
# REACT_APP_FIREBASE_MEASUREMENT_ID=G-... # Optional

# Google Maps API Key (Enable Maps JavaScript API in Google Cloud Console)
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSy..._maps

# Backend API URL (Should match the port in backend/.env)
REACT_APP_API_URL=http://localhost:8081
```
**2. frontend/.env:
# Firebase Web App Configuration (Get these from Firebase Console)
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=1:...:web:...
# REACT_APP_FIREBASE_MEASUREMENT_ID=G-... # Optional

# Google Maps API Key (Enable Maps JavaScript API in Google Cloud Console)
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSy..._maps

# Backend API URL (Should match the port in backend/.env)
REACT_APP_API_URL=http://localhost:8081

Important: After creating or modifying .env files, you often need to restart the respective development server (backend or frontend) for the changes to take effect.

Running the Application
You'll need two terminal windows open: one for the backend and one for the frontend.

1.Run the Backend Server:
cd backend
npm run dev # Uses nodemon for auto-restarts (recommended)
# OR
# npm start # Uses node directly
The backend should start, typically on http://localhost:8081.
2.Run the Frontend Development Server:
cd frontend
npm start
This will usually open the app automatically in your browser at http://localhost:8082 (or another available port like 3000 or 3003).
🤝 Contributing
Contributions are welcome! If you'd like to contribute:

Fork the repository.
Create a new branch (git checkout -b feature/YourFeature or fix/YourFix).
Make your changes.
Commit your changes (git commit -m 'Add some feature').
Push to the branch (git push origin feature/YourFeature).
Open a Pull Request.
Please ensure your code follows the existing style and includes tests where appropriate.
