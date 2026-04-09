import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
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
export const listReports = () => API.get('/validate/reports');

// Saved rule sets (feeds)
export const saveRuleSet = (data) => API.post('/rules/save', data);
export const updateRuleSet = (id, data) => API.put(`/rules/${id}`, data);
export const listSavedRules = () => API.get('/rules');
export const deleteSavedRule = (id) => API.delete(`/rules/${id}`);

export const getDownloadUrl = (id) => `${process.env.REACT_APP_API_BASE_URL}/validate/report/${id}/download`;
export const getColumnDownloadUrl = (id, column) => `${process.env.REACT_APP_API_BASE_URL}/validate/report/${id}/download?column=${encodeURIComponent(column)}`;

export default API;
