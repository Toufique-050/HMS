import axios from "axios";

export const TOKEN_KEY = "luxurystay_token";

const http = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "/api"
});

http.interceptors.request.use(config => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

http.interceptors.response.use(
    response => response,

    error => {
        if (
            error.response?.status === 401 &&
            !error.config?.url?.includes("/auth/login")
        ) {
            localStorage.removeItem(TOKEN_KEY);

            window.dispatchEvent(
                new Event("auth:expired")
            );
        }

        return Promise.reject(error);
    }
);

export const errorMessage = error => {
    return error.response?.data?.message ||
        "Request failed. Check that the backend is running.";
};

export default http;