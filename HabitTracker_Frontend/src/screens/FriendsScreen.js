import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Alert,
    LayoutAnimation,
    Platform,
    UIManager,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { friendAPI, userAPI } from '../api';

/* 
Friends Screen/ Community Screen
Includes the following functionality so far:

1) Friends Tab shows current active friends
2) Trying to have a recent activity feed to recent activity of friends
3) Swiping left on friend removes them
4) Discover tab contains pending requests and allows you to search to add new friends
*/


// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}


export default function FriendsScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('network');
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);

    const [recentActivity, setRecentActivity] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);

    const swipeableRefs = useRef({});

    // Fetch friends data from api
    // We execute the data fetching function every time we go onto this screen
    useFocusEffect(
        useCallback(() => {
            fetchNetworkData();
        }, [])
    );

    const fetchNetworkData = async () => {
        try {
            // allows initial state to cover first load, and then refocus refreshes silently
            const [friendsRes, requestsRes, activityRes] = await Promise.all([
                friendAPI.getFriends(),
                friendAPI.getRequests(),
                friendAPI.getRecentActivity()
            ]);
            setFriends(friendsRes.data);
            setPendingRequests(requestsRes.data);
            setRecentActivity(activityRes.data);
        } catch (error) {
            console.error("Failed to fetch network data:", error);
            Alert.alert("Error", "Could not load your network.");
        } finally {
            setLoading(false);
        }
    };


    // Adds timeout delay to prevent sending an API request on every keystroke
    useEffect(() => {
        // Abort the network operation if the user input is less than two characters to avoid unnecessary database queries
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);

        // The backend API will be queried after the user stops typing for half a second
        const delayDebounceFn = setTimeout(async () => {
            try {
                const response = await userAPI.searchUsers(searchQuery);
                setSearchResults(response.data);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setSearchLoading(false);
            }
        }, 500);

        // Clear the timeout on subsequent keystrokes
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);


    // Sends a delete request to the backend to remove a friend relationship
    const removeFriend = async (id) => {
        try {
            await friendAPI.unfriend(id);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFriends(current => current.filter(f => f.id !== id));
        } catch (error) {
            Alert.alert("Error", "Could not remove friend.");
            // Reset the swipeable row back to its closed position 
            swipeableRefs.current[id]?.close();
        }
    };

    // Sends an outbound friend request record to the database for a specific user ID
    const requestFriend = async (id) => {
        try {
            await friendAPI.sendRequest(id);
            Alert.alert("Request Sent", "Friend request has been sent successfully.");
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            // Filter out the targeted user from the current search results now
            setSearchResults(current => current.filter(user => user.id !== id));
        } catch (error) {
            Alert.alert("Error", "Could not send friend request.");
        }
    };

    // Updates a pending request record's status to accepted on the backend database and updates locally
    const acceptRequest = async (requestId) => {
        try {
            await friendAPI.acceptRequest(requestId);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setPendingRequests(current => current.filter(req => req.id !== requestId));
            // Re-fetch all network records from the server to append the newly accepted user into the active friends list
            fetchNetworkData();
        } catch (error) {
            Alert.alert("Error", "Could not accept request.");
        }
    };

    // Deletes the pending request record from the database table and updates the local pending requests array
    const declineRequest = async (requestId) => {
        try {
            await friendAPI.deleteRequest(requestId);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setPendingRequests(current => current.filter(req => req.id !== requestId));
        } catch (error) {
            Alert.alert("Error", "Could not decline request.");
        }
    };

    // Upper section containing the navigation tabs for switching between the main friends view and the discover view
    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('network')} activeOpacity={0.6}>
                    <Text style={[styles.tabText, activeTab === 'network' && styles.tabTextActive]}>
                        Friends
                    </Text>
                    {activeTab === 'network' && <View style={styles.activeDot} />}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveTab('discover')} activeOpacity={0.6}>
                    <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
                        Discover
                    </Text>
                    {activeTab === 'discover' && <View style={styles.activeDot} />}
                </TouchableOpacity>
            </View>
        </View>
    );

    // Visually show if users swipe fully to left it will delete friend
    const renderRightActions = () => (
        <View style={styles.swipeActionContainer}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
            <Text style={styles.swipeActionText}>Remove</Text>
        </View>
    );

  // Create active friend list
    const renderFriend = ({ item }) => {
        // Enforcing numerical fallbacks in case there are missing or undefined tracking properties
        const completedTasks = item.completed || 0;
        const totalTasks = item.totalHabits || 0;

        return (
            <Swipeable
                ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
                renderRightActions={renderRightActions}
                onSwipeableOpen={(direction) => {
                    // Check if the gesture meets the right-side threshold requirements before proceeding with the removal routine
                    if (direction === 'right') {
                        swipeableRefs.current[item.id]?.close();
                        // Execute the database removal operation after a minor delay to allow the row close animation to finish
                        setTimeout(() => removeFriend(item.id), 250);
                    }
                }}
            >
                <TouchableOpacity
                    style={styles.abstractRow}
                    activeOpacity={0.6}
                    onPress={() => navigation.navigate('FriendProfile', { friend: item })}
                >
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{item.name ? item.name.charAt(0).toUpperCase() : '?'}</Text>
                    </View>

                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.name}</Text>
                    </View>

                    <View style={styles.friendProgressContainer}>
                        <Text style={styles.progressFraction}>{completedTasks}/{totalTasks}</Text>
                        <Text style={styles.progressLabel}>Tasks Completed</Text>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    // Renders the log of user actions extracted from the active friends network data payload
    const renderActivityFeed = () => {
        if (recentActivity.length === 0) return null;
        return (
            <View style={styles.activitySection}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {recentActivity.map(activity => (
                    <View key={activity.id} style={styles.activityRow}>
                        <View style={styles.activityDot} />
                        <Text style={styles.activityText}>
                            <Text style={styles.activityUser}>{activity.user}</Text> completed <Text style={styles.activityTask}>{activity.task}</Text>
                        </Text>
                        <Text style={styles.activityTime}>{activity.time}</Text>
                    </View>
                ))}
            </View>
        );
    };

    // Renders a basic user profile layout for items returned from the database search endpoint
    const renderSearchItem = ({ item }) => (
        <View style={styles.abstractRow}>
            <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{item.name ? item.name.charAt(0).toUpperCase() : '?'}</Text>
            </View>

            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => requestFriend(item.id)}>
                <Ionicons name="person-add-outline" size={18} color="#3B82F6" />
            </TouchableOpacity>
        </View>
    );

    // Renders incoming friend requests
    const renderPendingRequests = () => {
        if (pendingRequests.length === 0) return null;
        return (
            <View style={styles.pendingSection}>
                <Text style={styles.sectionTitle}>Pending Requests</Text>
                {pendingRequests.map(req => (
                    <View key={req.id} style={styles.abstractRow}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{req.senderName ? req.senderName.charAt(0).toUpperCase() : '?'}</Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{req.senderName || 'Unknown User'}</Text>
                        </View>
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity style={styles.iconButtonAccept} onPress={() => acceptRequest(req.id)}>
                                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconButtonDecline} onPress={() => declineRequest(req.id)}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
                <View style={styles.sectionDivider} />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {renderHeader()}

            {activeTab === 'network' ? (
                loading ? (
                    <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={friends}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderFriend}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>Your network is quiet. Add some friends!</Text>}
                        ListFooterComponent={friends.length > 0 ? renderActivityFeed : null}
                    />
                )
            ) : (
                <View style={styles.discoverContainer}>
                    <View style={styles.searchWrapper}>
                        <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or email..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchLoading && <ActivityIndicator size="small" color="#3B82F6" />}
                    </View>

                    <FlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderSearchItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={renderPendingRequests}
                        ListEmptyComponent={
                            searchQuery.length >= 2 && !searchLoading ? (
                                <Text style={styles.emptyText}>No users found.</Text>
                            ) : null
                        }
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    headerContainer: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 20 },
    tabContainer: { flexDirection: 'row', gap: 30 },
    tabText: { fontSize: 32, fontWeight: '700', color: '#CBD5E1', letterSpacing: -0.5 },
    tabTextActive: { color: '#0F172A' },
    activeDot: { height: 4, width: 24, backgroundColor: '#3B82F6', borderRadius: 2, marginTop: 6 },

    listContent: { paddingHorizontal: 24, paddingBottom: 100 },
    abstractRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#F8FAFC' },

    avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    avatarText: { fontSize: 18, fontWeight: '600', color: '#475569' },
    userInfo: { flex: 1 },
    userName: { fontSize: 17, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
    userHandle: { fontSize: 13, color: '#64748B' },

    friendProgressContainer: { alignItems: 'flex-end' },
    progressFraction: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    progressLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },

    // Sections (Activity & Pending)
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginTop: 10 },
    sectionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20 },

    // Pending Requests specific
    pendingSection: { marginBottom: 10 },
    actionButtonsRow: { flexDirection: 'row', gap: 10 },
    iconButtonAccept: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
    iconButtonDecline: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

    // Activity Feed specific
    activitySection: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    activityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 12 },
    activityText: { flex: 1, fontSize: 14, color: '#475569' },
    activityUser: { fontWeight: '600', color: '#1E293B' },
    activityTask: { fontWeight: '600', color: '#1E293B' },
    activityTime: { fontSize: 12, color: '#94A3B8', marginLeft: 10 },

    // Discover & Search
    discoverContainer: { flex: 1 },
    searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 24, paddingHorizontal: 16, height: 50, borderRadius: 25, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: '#1E293B' },
    addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

    // Swipe Action
    swipeActionContainer: { justifyContent: 'center', alignItems: 'flex-end', paddingRight: 24, width: 100, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    swipeActionText: { color: '#EF4444', fontSize: 12, fontWeight: '600', marginTop: 4 },

    emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, color: '#94A3B8' }
});