import axios from "axios";

// Smart backend URL resolution:
//  1. Pakai REACT_APP_BACKEND_URL kalau di-set & bukan localhost fallback yang ke-bake
//  2. Kalau kosong / localhost di production → pakai window.location.origin
//     (sama-domain, lewat ingress/nginx proxy)
const RAW = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
const isBrowser = typeof window !== "undefined";
const isLocalhostBuild =
  RAW.includes("localhost") || RAW.includes("127.0.0.1") || RAW === "";
const browserIsLocalhost =
  isBrowser &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

let BACKEND_URL;
if (RAW && !isLocalhostBuild) {
  // explicit production URL baked in
  BACKEND_URL = RAW;
} else if (isBrowser && !browserIsLocalhost) {
  // accessed via real domain → use same origin (ingress will route /api)
  BACKEND_URL = window.location.origin;
} else {
  // local dev fallback
  BACKEND_URL = RAW || "http://localhost:8001";
}

export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 90000,
});

export const fetchTokens = async (params = {}) => {
  const { data } = await api.get("/tokens", { params });
  return data;
};

export const fetchToken = async (address) => {
  const { data } = await api.get(`/tokens/${address}`);
  return data;
};

export const analyzeToken = async (address) => {
  const { data } = await api.post(`/tokens/${address}/analyze`);
  return data;
};

export const getTelegramConfig = async () => {
  const { data } = await api.get("/telegram/config");
  return data;
};

export const testTelegram = async () => {
  const { data } = await api.post("/telegram/test");
  return data;
};

export const scanAndAlert = async (threshold) => {
  const { data } = await api.post("/telegram/scan-and-alert", null, {
    params: threshold ? { threshold } : {},
  });
  return data;
};

// --- Settings / pause controls ---
export const getSettings = async () => {
  const { data } = await api.get("/settings");
  return data;
};

export const setScannerPaused = async (paused) => {
  const { data } = await api.post("/settings/scanner", { paused });
  return data;
};
