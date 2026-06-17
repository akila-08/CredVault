import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// Attach the correct JWT automatically when present
API.interceptors.request.use((config) => {
    const url = config.url || "";
    const verifierRoutes = [
        "/api/credentials/verify",
        "/api/verifiers/profile",
        "/api/verifiers/change-password",
    ];
    const needsVerifierToken = verifierRoutes.some((route) => url.includes(route));
    const token = needsVerifierToken
        ? localStorage.getItem("cv_verifier_token")
        : localStorage.getItem("cv_uni_token");

    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default API;
