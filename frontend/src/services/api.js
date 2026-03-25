import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 0, // no timeout — large files can take minutes
});

// Request interceptor for logging
API.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error normalization
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    error.displayMessage = message;
    return Promise.reject(error);
  }
);

export const uploadFile = (formData, onProgress) =>
  API.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });

export const getUpload = (id) => API.get(`/upload/${id}`);

export const getAllUploads = () => API.get('/upload'); 

export const runValidation = (data) => API.post('/validate', data);  //validation check  

export const getReport = (id) => API.get(`/validate/report/${id}`);

export const getDownloadUrl = (id) => `http://localhost:5000/api/validate/report/${id}/download`;

export default API;
