import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

export const getUsers = () =>
  api.get('/auth/users').then(r => r.data);

// Documents
export const getDocuments = () =>
  api.get('/documents').then(r => r.data);

export const getDocument = (id) =>
  api.get(`/documents/${id}`).then(r => r.data);

export const createDocument = (data = {}) =>
  api.post('/documents', data).then(r => r.data);

export const updateDocument = (id, data) =>
  api.put(`/documents/${id}`, data).then(r => r.data);

export const deleteDocument = (id) =>
  api.delete(`/documents/${id}`).then(r => r.data);

// Sharing
export const shareDocument = (documentId, userId, permission) =>
  api.post(`/shares/${documentId}`, { userId, permission }).then(r => r.data);

export const revokeShare = (documentId, userId) =>
  api.delete(`/shares/${documentId}/${userId}`).then(r => r.data);

// Upload
export const uploadToDocument = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/upload/document', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const uploadAttachment = (documentId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/upload/attachment/${documentId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const deleteAttachment = (documentId, attachmentId) =>
  api.delete(`/upload/attachment/${documentId}/${attachmentId}`).then(r => r.data);

export default api;
