import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('finverse_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Auto token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('finverse_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          if (res.data?.access_token) {
            localStorage.setItem('finverse_access_token', res.data.access_token);
            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          localStorage.removeItem('finverse_access_token');
          localStorage.removeItem('finverse_refresh_token');
          localStorage.removeItem('finverse_user');
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
