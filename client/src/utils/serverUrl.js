/**
 * Returns the appropriate server URL based on the current environment
 * @returns {string} The server URL to use for API requests
 */
export function getServerUrl() {
  // First check for the environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // If not in localhost, use the current origin
  if (window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  
  // Default to localhost:3000 for development
  return 'http://localhost:3000';
}

/**
 * Returns the KinOS API base URL
 * @returns {string} The KinOS API base URL
 */
export function getKinosApiBaseUrl() {
  // First check for the environment variable
  if (import.meta.env.VITE_KINOS_API_BASE_URL) {
    return import.meta.env.VITE_KINOS_API_BASE_URL;
  }
  
  // Default to localhost:5000 for development
  return 'http://localhost:5000';
}
