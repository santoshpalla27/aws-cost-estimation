import axios, { AxiosError } from 'axios';
import type { ApiError } from '../types/api';

// Create axios instance with defaults
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
    timeout: 120000, // 2 minutes for large uploads
    headers: {
        'Accept': 'application/json',
    },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiError>) => {
        // Format error for consistent handling
        if (error.response?.data?.error) {
            // Backend error response
            return Promise.reject(error.response.data.error);
        }

        // Network or other errors
        return Promise.reject({
            code: 'NETWORK_ERROR',
            message: error.message || 'Network request failed',
            status: error.response?.status || 0,
        });
    }
);

export default apiClient;
