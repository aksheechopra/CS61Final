import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/*
This will act as an intemediary helping us easily map API calls to/from backend to 
our React frontend.

We do need to create a few more api calls:
1) findUser that searches for a user in database given a query
2) getRecentActivity fetches most recent logs of all accepted Friends that occured at most __ hours ago
*/

const API_URL = 'http://localhost:5000'; 

// Create an Axios instance
// This helps us create async network request with backend
const api = axios.create({
  baseURL: API_URL,
});

// Interceptor to attach the token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// LOGIN/REGISTER API
export const authAPI = {
  login: (credentials) => api.post('/login', credentials),
  logout: () => api.post('/logout'),
  createUser: (userData) => api.post('/users', userData),
};

// USER API
export const userAPI = {
  updateMe: (data) => api.put('/users/me', data),
  deleteMe: () => api.delete('/users/me'),
  deleteUser: (id) => api.delete(`/users/${id}`), // Admin only
};

// HABIT API
export const habitAPI = {
  getAllHabits: () => api.get('/habits'), // Admin only
  getMyHabits: () => api.get('/habits/me'),
  getHabit: (id) => api.get(`/habits/${id}`),
  getFriendHabits: () => api.get('/habits/friends'),
  createHabit: (data) => api.post('/habits/', data),
  updateHabit: (id, data) => api.put(`/habits/${id}`, data),
  deleteHabit: (id) => api.delete(`/habits/${id}`),
};

// HABITLOG API
export const logAPI = {
  createLog: (habitId, data) => api.post(`/habits/${habitId}/log`, data),
  deleteLog: (logId) => api.delete(`/habitsLogs/${logId}`),
  updateLog: (logId, data) => api.put(`/habitsLogs/${logId}`, data),
  getLogs: (habitId) => api.get(`/habits/${habitId}/logs`),
};

// FRIEND API
export const friendAPI = {
  sendRequest: (userId) => api.post(`/friendRequest/${userId}`),
  acceptRequest: (requestId) => api.put(`/friendRequest/${requestId}`),
  deleteRequest: (requestId) => api.delete(`/friendRequest/${requestId}`),
  getRequests: () => api.get('/friendRequests'),
  getFriends: () => api.get('/friends'),
  unfriend: (friendId) => api.delete(`/friends/${friendId}`),
};

export default api;