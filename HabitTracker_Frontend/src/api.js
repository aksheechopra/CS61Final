/*  import * as SecureStore from 'expo-secure-store';

// ==========================================
// TEST DATABASE (Created using ChatGPT)
// ==========================================
const CURRENT_USER_ID = 1;

let mockUsers = [
  { UserID: 1, Name: 'Current User', Email: 'me@test.com' },
  { UserID: 2, Name: 'Alex Rivera', Email: 'alex@test.com' },
  { UserID: 3, Name: 'Jordan Lee', Email: 'jordan@test.com' },
  { UserID: 4, Name: 'Taylor Smith', Email: 'taylor@test.com' },
  { UserID: 5, Name: 'Casey Hayes', Email: 'casey@test.com' },
  { UserID: 6, Name: 'Morgan Vance', Email: 'morgan@test.com' },
];

// Status: 0 = Pending, 1 = Accepted
let mockFriendships = [
  { FriendshipID: 1, Status: 1, SenderID: 2, RecipientID: 1 }, 
  { FriendshipID: 2, Status: 1, SenderID: 1, RecipientID: 3 }, 
  { FriendshipID: 3, Status: 0, SenderID: 4, RecipientID: 1 }, 
  { FriendshipID: 4, Status: 0, SenderID: 5, RecipientID: 1 }, 
];

let mockHabits = [
  { HabitID: 1, UserID: 1, HabitName: 'Morning Run', HabitDescription: 'Run 3 miles', Status: 'Active', Streak: 5 },
  { HabitID: 2, UserID: 1, HabitName: 'Read', HabitDescription: '20 pages a day', Status: 'Active', Streak: 12 },
];

let mockLogs = [];

let mockActivity = [
  { id: '1', user: 'Alex Rivera', task: 'Morning Run', time: '2h ago' },
  { id: '2', user: 'Jordan Lee', task: 'Read 20 Pages', time: '4h ago' },
  { id: '3', user: 'Alex Rivera', task: 'Meditation', time: '5h ago' },
];

// ==========================================
// HELPER: Simulate Network Delay
// ==========================================
const withDelay = (data, delay = 500) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data }), delay);
  });
};

// ==========================================
// MOCK API ENDPOINTS
// ==========================================

export const authAPI = {
  login: async (credentials) => {
    await SecureStore.setItemAsync('userToken', 'mock-jwt-token-123');
    return withDelay({ token: 'mock-jwt-token-123', user: mockUsers[0] });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('userToken');
    return withDelay({ success: true });
  },
  createUser: (userData) => {
    const newUser = { UserID: mockUsers.length + 1, ...userData };
    mockUsers.push(newUser);
    return withDelay(newUser);
  },
};

export const userAPI = {
  getMe: () => withDelay(mockUsers[0]),
  
  // allows edits to persist across reloads in a session
  updateMe: (data) => {
    mockUsers[0] = { ...mockUsers[0], ...data };
    return withDelay(mockUsers[0]);
  },
  deleteMe: () => withDelay({ success: true }),
  deleteUser: (id) => {
    mockUsers = mockUsers.filter(u => u.UserID !== id);
    return withDelay({ success: true });
  },
  searchUsers: (query) => {
    const lowerQuery = query.toLowerCase();
    const results = mockUsers.filter(u => 
      u.UserID !== CURRENT_USER_ID && 
      (u.Name.toLowerCase().includes(lowerQuery) || u.Email.toLowerCase().includes(lowerQuery))
    ).map(u => ({
      ...u,
      id: u.UserID // Mapped for frontend FlatList keyExtractor support
    }));
    return withDelay(results);
  },
};

export const habitAPI = {
  getAllHabits: () => withDelay(mockHabits),
  getMyHabits: () => {
    const myHabits = mockHabits.filter(h => h.UserID === CURRENT_USER_ID);
    return withDelay(myHabits);
  },
  getHabit: (id) => {
    const habit = mockHabits.find(h => h.HabitID === id);
    return withDelay(habit);
  },
  getFriendHabits: () => withDelay([]),
  createHabit: (data) => {
    const newHabit = { HabitID: mockHabits.length + 1, UserID: CURRENT_USER_ID, ...data, Streak: 0 };
    mockHabits.push(newHabit);
    return withDelay(newHabit);
  },
  updateHabit: (id, data) => {
    const index = mockHabits.findIndex(h => h.HabitID === id);
    if (index > -1) mockHabits[index] = { ...mockHabits[index], ...data };
    return withDelay(mockHabits[index]);
  },
  deleteHabit: (id) => {
    mockHabits = mockHabits.filter(h => h.HabitID !== id);
    return withDelay({ success: true });
  },
};

export const logAPI = {
  createLog: (habitId, data) => {
    const newLog = { 
      HabitLogID: mockLogs.length + 1, 
      HabitID: habitId, 
      DateLogged: data.date || new Date().toISOString() 
    };
    mockLogs.push(newLog);
    return withDelay(newLog);
  },
  deleteLog: (logId) => {
    mockLogs = mockLogs.filter(l => l.HabitLogID !== logId);
    return withDelay({ success: true });
  },
  updateLog: (logId, data) => {
    const index = mockLogs.findIndex(l => l.HabitLogID === logId);
    if (index > -1) mockLogs[index] = { ...mockLogs[index], ...data };
    return withDelay(mockLogs[index]);
  },
  getLogs: (habitId) => {
    const logs = mockLogs.filter(l => l.HabitID === habitId);
    return withDelay(logs);
  },
};

const SAMPLE_HABITS = [
  { HabitName: 'Morning Run', HabitDescription: '3 mile loop' },
  { HabitName: 'Read', HabitDescription: '20 pages a day' },
  { HabitName: 'Meditation', HabitDescription: '10 minutes' },
  { HabitName: 'Hydrate', HabitDescription: '8 glasses of water' },
  { HabitName: 'Journal', HabitDescription: 'One page nightly' },
  { HabitName: 'Stretch', HabitDescription: 'Full body, 15 min' },
];

export const friendAPI = {
  getRecentActivity: () => withDelay(mockActivity),

  getFriendProfile: (friendId) => {
    const user = mockUsers.find(u => u.UserID === friendId);
    if (!user) return withDelay(null);

    const totalHabits = (friendId * 2) % 4 + 3;
    const completed = (friendId * 3) % totalHabits;
    const failed = Math.max(0, totalHabits - completed - 1);
    const longestStreak = (friendId * 7) % 18 + 4;

    const habits = SAMPLE_HABITS.slice(0, totalHabits).map((h, i) => ({
      HabitID: friendId * 100 + i,
      UserID: friendId,
      HabitName: h.HabitName,
      HabitDescription: h.HabitDescription,
      Streak: ((friendId + i) * 3) % 14,
      completedToday: i < completed,
    }));

    const logDates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const density = 0.25 + ((friendId * 13) % 40) / 100;
    
    // seeded this by friendId so each heatmap stays consistent per person
    for (let i = 0; i < 12 * 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const rand = (((friendId + 1) * 9301 + i * 49297) % 233280) / 233280;
      if (rand < density) {
        const n = 1 + Math.floor(rand * 5) % 4;
        for (let k = 0; k < n; k++) logDates.push(new Date(d));
      }
    }

    return withDelay({
      user: { ...user, id: user.UserID, name: user.Name, email: user.Email },
      stats: { totalHabits, completedToday: completed, failedToday: failed, longestStreak },
      habits,
      logDates,
    });
  },

  getFriends: () => {
    const friendIds = mockFriendships
      .filter(f => f.Status === 1 && (f.SenderID === CURRENT_USER_ID || f.RecipientID === CURRENT_USER_ID))
      .map(f => f.SenderID === CURRENT_USER_ID ? f.RecipientID : f.SenderID);
    
    const friends = mockUsers
      .filter(u => friendIds.includes(u.UserID))
      .map(u => ({
        ...u,
        id: u.UserID, // Mapped so frontend swipeables/lists don't break
        name: u.Name, // Fallback mapping
        email: u.Email, // Fallback mapping
        totalHabits: Math.floor(Math.random() * 5) + 3, 
        completed: Math.floor(Math.random() * 4)        
      }));
      
    return withDelay(friends);
  },
  getRequests: () => {
    const requestIds = mockFriendships
      .filter(f => f.Status === 0 && f.RecipientID === CURRENT_USER_ID)
      .map(f => f.SenderID);
      
    const requests = mockUsers
      .filter(u => requestIds.includes(u.UserID))
      .map(u => ({
        id: u.UserID, // Mapped for frontend request handling
        senderName: u.Name, 
        senderEmail: u.Email 
      }));
      
    return withDelay(requests);
  },
  sendRequest: (userId) => {
    mockFriendships.push({
      FriendshipID: mockFriendships.length + 1,
      Status: 0,
      SenderID: CURRENT_USER_ID,
      RecipientID: userId
    });
    return withDelay({ success: true });
  },
  acceptRequest: (senderId) => {
    const request = mockFriendships.find(f => f.SenderID === senderId && f.RecipientID === CURRENT_USER_ID);
    if (request) request.Status = 1;
    return withDelay({ success: true });
  },
  deleteRequest: (senderId) => {
    mockFriendships = mockFriendships.filter(f => !(f.SenderID === senderId && f.RecipientID === CURRENT_USER_ID));
    return withDelay({ success: true });
  },
  unfriend: (friendId) => {
    mockFriendships = mockFriendships.filter(f => 
      !(f.SenderID === CURRENT_USER_ID && f.RecipientID === friendId) && 
      !(f.SenderID === friendId && f.RecipientID === CURRENT_USER_ID)
    );
    return withDelay({ success: true });
  },
};

export default {}; **/
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
 
/*
This will act as an intemediary helping us easily map API calls to/from backend to 
our React frontend.
 
We do need to create a few more api calls:
1) searchUsers that searches for a user in database given a query
2) getRecentActivity fetches most recent logs of all accepted Friends that occured at most __ hours ago
*/
 
const API_URL = 'http://localhost:8080';
 
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
  // Backend /login expects { Email, Password } (PascalCase)
  login: (credentials) => api.post('/login', {
    Email: credentials.email,
    Password: credentials.password,
  }),
  logout: () => SecureStore.deleteItemAsync('userToken'),
  // Use plain axios (not the `api` instance) so the token interceptor doesn't run —
  // the user has no token yet when registering.
  register: (userData) => axios.post(`${API_URL}/register`, userData),
};
 
// USER API
export const userAPI = {
  getMe: () => api.get('/users/me'),
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
  createHabit: (data) => api.post('/habits', data),
  updateHabit: (id, data) => api.put(`/habits/${id}`, data),
  deleteHabit: (id) => api.delete(`/habits/${id}`),
};

// HABITLOG API
export const logAPI = {
  // Backend expects { DateLogged, CompletionStatus }
  createLog: (habitId, data) => api.post(`/habits/${habitId}/log`, {
    DateLogged: data.date || data.DateLogged || new Date().toISOString(),
    CompletionStatus: data.CompletionStatus || 'Completed',
  }),
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