export const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        // If we are on production domain or IP
        if (hostname === 'omniragengine.com' || hostname === '209.159.154.228') {
            // Use the same protocol and host, but target the backend port 8010
            return `${protocol}//${hostname}:8010`;
        }
    }

    // Default to local development
    return 'http://localhost:8010';
};

export const API_BASE_URL = getBaseUrl();
