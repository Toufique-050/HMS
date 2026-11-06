import http from "../../api/http.js";

export const signUp = async body => {
    return (await http.post("/auth/signUp", body)).data;
};

export const login = async body => {
    return (await http.post("/auth/login", body)).data;
};

export const getMe = async () => {
    return (await http.get("/auth/me")).data;
};

export const logout = async () => {
    return (await http.post("/auth/logout")).data;
};

export const updateProfile = async body => {
    return (await http.patch("/auth/profile", body)).data;
};

export const changePassword = async body => {
    return (
        await http.post("/auth/change-password", body)
    ).data;
};