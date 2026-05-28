import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
