import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/*
This will act as an intemediary helping us easily map API calls to/from backend to 
our React frontend.

We do need to create a few more api calls:
1) searchUsers that searches for a user in database given a query
2) getRecentActivity fetches most recent logs of all accepted Friends that occured at most __ hours ago
*/

const API_URL = 'http://192.168.1.42:8080';

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
  logout: () => SecureStore.deleteItemAsync('userToken'),
  register: (userData) => api.post('/register', userData), 
};

// USER API
export const userAPI = {
  updateMe: (data) => api.put('/users/me', data),
  deleteMe: () => api.delete('/users/me'),
  deleteUser: (id) => api.delete(`/users/${id}`), // Admin only
  searchUsers: (query) => api.get(`/users/search?query=${query}`),
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
  deleteLog: (habitId, logId) => api.delete(`/habits/${habitId}/logs/${logId}`),
  updateLog: (habitId, logId, data) => api.put(`/habits/${habitId}/logs/${logId}`, data),
  getLogs: (habitId) => api.get(`/habits/${habitId}/logs`),
};

// FRIEND API
export const friendAPI = {
  sendRequest: (userId) => api.post('/friend_requests', { RecipientID: userId }),
  acceptRequest: (requestId) => api.put(`/friend_requests/${requestId}`),
  deleteRequest: (requestId) => api.delete(`/friend_requests/${requestId}`),
  getRequests: () => api.get('/friend_requests/incoming'),
  getFriends: () => api.get('/friends'),
  unfriend: (friendId) => api.delete(`/friends/${friendId}`),
  getRecentActivity: () => api.get('/friends/activity'),
  getFriendProfile: (friendId) => api.get(`/friends/${friendId}/profile`), 
};

export default api;