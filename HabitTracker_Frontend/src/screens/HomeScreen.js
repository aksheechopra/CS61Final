import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Alert,
    LayoutAnimation,
    Platform,
    UIManager,
    Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';

// We import our api functionality here
import { habitAPI, logAPI } from '../api';

/* 
User Home Screen/ Main Daily Habits Screen
Includes the following functionality so far:

1) Should fetch habit data from db for today's date
2) Habits formatted as list
3) Button to add new habit
4) Tapping a habit allows you to see habit details as well as update (Need to add delete)
5) Swiping a habit to the left marks habit as complete
*/

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ACCENT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
const SUCCESS_GREEN = '#10B981';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const [habits, setHabits] = useState([]);

    // Store references to swipeable rows so they can be closed programmatically
    const swipeableRowRefs = useRef({});
    // Used to trigger the confetti animation after completing a habit
    const confettiRef = useRef(null);

    useFocusEffect(
        useCallback(() => {
            // Refresh habits whenever user returns to this screen
            fetchHabits();
        }, [])
    );

    const fetchHabits = async () => {
        try {
            // Fetch all habits for the user
            const response = await habitAPI.getMyHabits();
            const habitsData = response.data;

            const todayString = new Date().toDateString();

            // Fetch logs for each habit concurrently to check for today's habits
            const habitsWithStatus = await Promise.all(
                habitsData.map(async (habit) => {
                    try {
                        // get HabitID from your SQL tables
                        const habitId = habit.HabitID;

                        const logsRes = await logAPI.getLogs(habitId);
                        const logs = logsRes.data;

                        // Check if any log's date matches today
                        const completedToday = logs.some(log => {
                            //SQL DATETIME column naming
                            const logDateString = log.DateLogged;
                            return new Date(logDateString).toDateString() === todayString;
                        });

                        return {
                            ...habit,
                            completedToday
                        };
                    } catch (logError) {
                        console.error(`Failed to fetch logs for habit ${habit.HabitName}:`, logError);
                        // If logs fail to load for a specific habit, default to false 
                        return { ...habit, completedToday: false };
                    }
                })
            );

            setHabits(habitsWithStatus);
        } catch (error) {
            console.error("Failed to fetch habits:", error);
            Alert.alert("Error", "Could not load your habits.");
        }
    };

    const markComplete = async (habitId) => {
        try {
            // Create a completion log for today's date
            await logAPI.createLog(habitId, { date: new Date().toISOString() });

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

            setHabits(currentHabits =>
                currentHabits.map(habit =>
                    habit.HabitID === habitId ? { ...habit, completedToday: true } : habit
                )
            );
        } catch (error) {
            Alert.alert("Error", "Could not log habit.");
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (confettiRef.current) {
            confettiRef.current.start();
        }
    };

    const totalHabits = habits.length;
    const completedHabits = habits.filter(h => h.completedToday).length;
    // Calculate overall daily progress for the progress bar
    const progressPercentage = totalHabits === 0 ? 0 : (completedHabits / totalHabits) * 100;

    const sortedHabits = [...habits].sort((a, b) => {
        if (a.completedToday === b.completedToday) return 0;
        return a.completedToday ? 1 : -1;
    });

    const renderHeader = () => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        return (
            <View style={styles.headerContainer}>
                <Text style={styles.dateText}>{today}</Text>
                <View style={styles.titleRow}>
                    <Text style={styles.greetingText}>My Habits</Text>
                    <Text style={styles.progressFraction}>{completedHabits} / {totalHabits}</Text>
                </View>

                <View style={styles.abstractTrack}>
                    <View style={[styles.abstractFill, { width: `${progressPercentage}%` }]} />
                </View>
            </View>
        );
    };

    const renderRightActions = () => (
        <View style={styles.swipeAction}>
            <Ionicons name="checkmark" size={32} color="white" />
        </View>
    );

    const renderItem = ({ item, index }) => {
        const themeColor = ACCENT_COLORS[index % ACCENT_COLORS.length];

        return (
            <Swipeable
                ref={(ref) => { swipeableRowRefs.current[item.HabitID] = ref; }}
                renderRightActions={item.completedToday ? null : renderRightActions}
                onSwipeableOpen={(direction) => {
                    if (direction === 'right' && !item.completedToday) {

                        // vibrate to signal completion
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                        // "Close" the card
                        swipeableRowRefs.current[item.HabitID]?.close();

                        // Shuffle to bottom
                        setTimeout(() => {
                            markComplete(item.HabitID);
                        }, 200);
                    }
                }}
            >
                <TouchableOpacity
                    style={[styles.habitCard, item.completedToday && styles.habitCardCompleted]}
                    onPress={() => navigation.navigate('HabitDetails', { habitId: item.HabitID })}
                    activeOpacity={0.7}
                >
                    <View style={styles.habitCardContent}>
                        <View style={styles.habitTextWrapper}>
                            <Text style={[styles.habitName, item.completedToday && styles.habitNameCompleted]}>
                                {item.HabitName}
                            </Text>
                            <Text style={styles.habitDescription} numberOfLines={1}>
                                {item.HabitDescription || 'No description'}
                            </Text>
                        </View>

                        <View style={[
                            styles.statusCircle,
                            { borderColor: item.completedToday ? SUCCESS_GREEN : themeColor },
                            item.completedToday && { backgroundColor: SUCCESS_GREEN }
                        ]}>
                            {item.completedToday ? (
                                <Ionicons name="checkmark" size={18} color="white" />
                            ) : (
                                <View style={[styles.statusDot, { backgroundColor: themeColor, opacity: 0.2 }]} />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={sortedHabits}
                keyExtractor={(item) => item.HabitID.toString()}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={styles.emptyText}>No habits yet. Tap + to add one!</Text>}
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddHabit')}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={32} color="white" />
            </TouchableOpacity>

            <ConfettiCannon
                count={70}
                origin={{ x: windowWidth / 2, y: windowHeight + 50 }}
                autoStart={false}
                ref={confettiRef}
                fadeOut={true}
                fallSpeed={2000}
                colors={ACCENT_COLORS}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    listContent: { paddingBottom: 100, paddingTop: 60, paddingHorizontal: 20 },

    headerContainer: { marginBottom: 30 },
    dateText: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4, marginBottom: 15 },
    greetingText: { fontSize: 36, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    progressFraction: { fontSize: 18, fontWeight: '700', color: '#3B82F6', marginBottom: 6 },

    abstractTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', width: '100%' },
    abstractFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },

    habitCard: { backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 12, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
    habitCardCompleted: { backgroundColor: '#F1F5F9', shadowOpacity: 0, elevation: 0 },
    habitCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22 },
    habitTextWrapper: { flex: 1, paddingRight: 15 },
    habitName: { fontSize: 19, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    habitNameCompleted: { color: '#94A3B8', textDecorationLine: 'line-through' },
    habitDescription: { fontSize: 14, color: '#64748B', fontWeight: '500' },

    statusCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    statusDot: { width: 10, height: 10, borderRadius: 5 },

    swipeAction: { backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', width: 80, marginBottom: 12, borderRadius: 20, marginLeft: 10 },

    emptyText: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#94A3B8' },
    fab: { position: 'absolute', bottom: 30, right: 24, backgroundColor: '#0F172A', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 6 }
});