import axios from 'axios';

// تعیین baseURL براساس محیط
const getBaseURL = () => {
  // اگر متغیر محیط تعریف شده باشد، از آن استفاده کنید
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // اگر در development mode هستیم
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }

  // اگر در production mode هستیم
  return 'https://api.example.com';
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// اضافه کردن interceptor برای خطاهای API
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
