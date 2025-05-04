// frontend/src/components/settings/EditProfileForm.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import './SettingsForms.css';

function EditProfileForm() {
    const { currentUser, loading, refreshUserData } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName || '');
        }
    }, [currentUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        if (!displayName || displayName.trim().length < 3) {
            setError('Display name must be at least 3 characters.');
            setIsLoading(false);
            return;
        }

        if (!currentUser || typeof currentUser.getIdToken !== 'function') {
             setError('User session is invalid. Please log out and log back in.');
             setIsLoading(false);
             return;
        }

        // --- Get the Backend API Base URL from Environment Variables ---
        // Ensure REACT_APP_API_URL is set correctly in your .env file / Render frontend environment
        const backendApiUrl = process.env.REACT_APP_API_URL;
        if (!backendApiUrl) {
             console.error("CRITICAL FRONTEND ERROR: REACT_APP_API_URL is not defined!");
             setError("Application configuration error. Cannot reach server.");
             setIsLoading(false);
             return; // Stop if the base URL isn't configured
        }
        // --- End Base URL Check ---

        try {
            const token = await currentUser.getIdToken();

            // --- CORRECTED API CALL ---
            // Construct the full URL using the environment variable
            const fullApiUrl = `${backendApiUrl}/api/user/profile`; // <<< FIX
            console.log(`EditProfileForm: Making PUT request to: ${fullApiUrl}`); // Log the URL being used

            const response = await axios.put(
                fullApiUrl, // Use the fully constructed URL
                { displayName: displayName.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // --- END CORRECTION ---

            setSuccess(response.data.message || 'Profile updated successfully!');

            if (typeof refreshUserData === 'function') {
                console.log("EditProfileForm: Calling refreshUserData...");
                await refreshUserData();
                console.log("EditProfileForm: refreshUserData completed.");
            } else {
                 console.warn("EditProfileForm: refreshUserData function not found in AuthContext.");
                 setSuccess(prev => prev + " (Refresh page to see changes everywhere)");
            }

        } catch (err) {
            console.error("Profile update error:", err);
             if (err instanceof TypeError && err.message.includes('refreshUserData')) {
                 setError('Profile saved, but failed to refresh display immediately. Please refresh the page.');
             } else {
                 setError(err.response?.data?.error || 'Failed to update profile. Please try again.');
                 setSuccess('');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (loading && !currentUser) {
        return <p className="loading-message">Loading profile...</p>;
    }
    if (!currentUser) {
         return <p className="error-message">Could not load user profile. Please try refreshing.</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="settings-form">
            <h3>Edit Profile</h3>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    minLength="3"
                    maxLength="50"
                    disabled={isLoading}
                    aria-describedby="displayNameHelp"
                />
                 <small id="displayNameHelp">Your public name (3-50 characters).</small>
            </div>
             <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                    type="email"
                    id="email"
                    value={currentUser.email || ''}
                    disabled
                    readOnly
                />
                 <small>Email address cannot be changed here.</small>
            </div>
            <button
                type="submit"
                disabled={isLoading || displayName === (currentUser?.displayName || '')}
            >
                {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>
    );
}

export default EditProfileForm;