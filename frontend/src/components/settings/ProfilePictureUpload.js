// src/components/settings/ProfilePictureUpload.js
import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import './SettingsForms.css';

function ProfilePictureUpload() {
    const { currentUser, refreshUserData } = useAuth();
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit example
                 setError('File is too large. Maximum size is 5MB.');
                 setSelectedFile(null);
                 setPreview(null);
                 // Clear the file input value so user can select same file again if needed after error
                 if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                 }
                 return;
            }
            setSelectedFile(file);
            setError(''); // Clear error on valid selection
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else if (file) { // Only show error if a file was selected but it was invalid
             setError('Please select a valid image file (JPEG, PNG, GIF, WEBP).');
             setSelectedFile(null);
             setPreview(null);
             if (fileInputRef.current) {
                fileInputRef.current.value = "";
             }
        } else {
            // If no file was selected (e.g., user clicked cancel)
            // Optionally clear error or do nothing
             // setError('');
             setSelectedFile(null);
             setPreview(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) { // Check only for selectedFile here
             setError('Please select an image file first.');
             return;
        }
        if (!currentUser || typeof currentUser.getIdToken !== 'function') {
             setError('User session is invalid. Please log out and log back in.');
             return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        // --- Get the Backend API Base URL from Environment Variables ---
        const backendApiUrl = process.env.REACT_APP_API_URL;
        if (!backendApiUrl) {
             console.error("CRITICAL FRONTEND ERROR: REACT_APP_API_URL is not defined!");
             setError("Application configuration error. Cannot reach server.");
             setIsLoading(false);
             return; // Stop if the base URL isn't configured
        }
        // --- End Base URL Check ---

        const formData = new FormData();
        // Key ('profilePic') MUST match upload.single('profilePic') in backend userRoutes.js
        formData.append('profilePic', selectedFile);

        try {
            const token = await currentUser.getIdToken();

            // --- CORRECTED API CALL ---
            // Construct the full URL using the environment variable
            const fullApiUrl = `${backendApiUrl}/api/user/profile-picture`; // <<< FIX
            console.log(`ProfilePictureUpload: Making POST request to: ${fullApiUrl}`); // Log the URL

            const response = await axios.post(
                fullApiUrl, // Use the fully constructed URL
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data', // Important for file uploads
                        Authorization: `Bearer ${token}`,
                    },
                    // Optional: Add progress tracking if needed
                    // onUploadProgress: progressEvent => { ... }
                }
            );
            // --- END CORRECTION ---

            setSuccess(response.data.message || 'Profile picture updated successfully!');
            setSelectedFile(null); // Clear selection state
            setPreview(null); // Clear preview after successful upload
             if (fileInputRef.current) { // Clear the actual file input field
                fileInputRef.current.value = "";
             }

            // Refresh user data to get the new photoURL into the context
            if (typeof refreshUserData === 'function') {
                console.log("ProfilePictureUpload: Calling refreshUserData...");
                await refreshUserData();
                console.log("ProfilePictureUpload: refreshUserData completed.");
            } else {
                console.warn("ProfilePictureUpload: refreshUserData function not found in AuthContext.");
                setSuccess(prev => prev + " (Refresh page to see changes everywhere)");
            }

        } catch (err) {
             console.error("Profile picture upload error:", err);
              // Handle specific errors like file size limit from backend (if backend sends 4xx)
             setError(err.response?.data?.error || 'Failed to upload picture. Please try again.');
             setSuccess(''); // Clear success on error
        } finally {
            setIsLoading(false);
        }
    };

    // Function to trigger the hidden file input
    const triggerFileInput = () => {
        // Clear previous errors/success when choosing a new file
        setError('');
        setSuccess('');
        fileInputRef.current?.click();
    };

    // Determine the source for the image preview
    const imageSource = preview // Show optimistic preview first
        || currentUser?.photoURL // Then current photoURL from context
        || '/default-avatar.png'; // Fallback to a default image (ensure this path is correct in your public folder)

    return (
        <div className="settings-form">
            <h3>Profile Picture</h3>
             {error && <p className="error-message">{error}</p>}
             {success && <p className="success-message">{success}</p>}

            <div className="profile-picture-preview">
                 <img
                    src={imageSource}
                    alt="Profile Preview"
                    className="avatar-image" // Style this class
                    onError={(e) => { // Handle broken image links (optional)
                         console.warn("Failed to load profile image:", imageSource);
                         e.target.onerror = null; // Prevent infinite loop if default also fails
                         e.target.src = '/default-avatar.png'; // Set to default on error
                    }}
                />
            </div>

            {/* Hidden file input, linked by ref */}
             <input
                type="file"
                accept="image/jpeg, image/png, image/gif, image/webp" // Be more specific with accepted types
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="profilePicInput" // Add id for label association if needed
            />

            {/* Custom button to open file dialog */}
             <button
                 type="button"
                 onClick={triggerFileInput}
                 disabled={isLoading}
                 className="button-outline" // Use consistent button styling
             >
                Choose Image
             </button>

            {/* Show selected file name and upload button only when a file is selected */}
            {selectedFile && (
                <div className="file-actions">
                     {/* Display file info */}
                     <span className="selected-filename">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                     {/* Upload button */}
                     <button
                        onClick={handleUpload}
                        disabled={isLoading || !selectedFile} // Disable if loading or no file
                        className="button-primary" // Use consistent styling
                    >
                        {isLoading ? 'Uploading...' : 'Upload & Save'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default ProfilePictureUpload;