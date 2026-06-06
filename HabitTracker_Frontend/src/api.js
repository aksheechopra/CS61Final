import * as SecureStore from 'expo-secure-store';

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
  updateMe: (data) => withDelay({ ...mockUsers[0], ...data }),
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

export const friendAPI = {
  getRecentActivity: () => withDelay(mockActivity), 
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

export default {};