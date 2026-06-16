import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// Attach university JWT automatically if present
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("cv_uni_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default API;
