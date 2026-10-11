import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// Attach the correct JWT automatically when present.
// Calls that pass an Authorization header explicitly, such as Supabase student
// session calls, are left unchanged.
API.interceptors.request.use((config) => {
    const existingAuth =
        config.headers?.Authorization ||
        config.headers?.authorization ||
        (typeof config.headers?.get === "function" && (config.headers.get("Authorization") || config.headers.get("authorization")));

    if (existingAuth) {
        return config;
    }

    const url = config.url || "";
    const isStudentRoute =
        url.startsWith("/api/verification-requests/student") ||
        url.includes("/approve") ||
        url.includes("/reject");

    if (isStudentRoute) {
        return config;
    }

    const isVerifierRoute =
        url.startsWith("/api/verifiers") ||
        url === "/api/credentials/verify" ||
        url === "/api/verification-requests" ||
        url.startsWith("/api/verification-requests/verifier");

    const token = isVerifierRoute
        ? localStorage.getItem("cv_verifier_token")
        : localStorage.getItem("cv_uni_token");

    if (token) {
        if (typeof config.headers?.set === "function") {
            config.headers.set("Authorization", `Bearer ${token}`);
        } else {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export default API;
