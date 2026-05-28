import axios from "axios";

// Try multiple sources for backend URL (in priority order)
const getBackendURL = () => {
  // 1. Runtime config from index.html
  if (window.__RUNTIME_CONFIG__?.BACKEND_URL) {
    return window.__RUNTIME_CONFIG__.BACKEND_URL;
  }
  
  // 2. Process env (works in dev mode)
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // 3. Fallback to current origin
  return window.location.origin;
};

const BACKEND_URL = getBackendURL();
export const API = `${BACKEND_URL}/api`;

// Debug log
console.log("🔧 API Config:", {
  RUNTIME_CONFIG: window.__RUNTIME_CONFIG__,
  REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
  BACKEND_URL,
  API,
});

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
