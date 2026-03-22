export const getBaseUrl = () => {
    // If we are on production domain or IP
    if (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'omniragengine.com' || window.location.hostname === '209.159.154.228')
    ) {
        return 'https://omniragengine.com';
    }

    // Default to local development
    return 'http://localhost:8010';
};

export const API_BASE_URL = getBaseUrl();
