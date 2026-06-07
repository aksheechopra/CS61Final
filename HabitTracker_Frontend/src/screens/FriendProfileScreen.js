import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { friendAPI } from '../api';
import ActivityHeatmap from '../components/ActivityHeatmap';

export default function FriendProfileScreen({ route, navigation }) {
  const friend = route?.params?.friend;
  const friendId = friend?.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState('all');

  const scrollRef = useRef(null);
  const habitsY = useRef(0);

  useFocusEffect(useCallback(() => {
    if (!friendId) {
      Alert.alert('Error', 'No friend selected.');
      navigation.goBack();
      return;
    }
    setLoading(true);
    friendAPI.getFriendProfile(friendId)
      .then(res => setProfile(res.data))
      .catch(() => Alert.alert('Error', 'Could not load this profile.'))
      .finally(() => setLoading(false));
  }, [friendId]));

  // allows useMemo to runs in same hook slot
  const habits = profile?.habits || [];
  const filteredHabits = useMemo(() => {
    if (filter === 'completed') return habits.filter(h => h.completedToday);
    if (filter === 'missed') return habits.filter(h => !h.completedToday);
    if (filter === 'streak') {
      const max = habits.reduce((m, h) => Math.max(m, h.Streak || 0), 0);
      return max === 0 ? [] : habits.filter(h => (h.Streak || 0) === max);
    }
    return habits;
  }, [habits, filter]);

  const unfriend = () => Alert.alert(
    'Remove friend', `Remove ${friend?.name || 'this user'} from your friends?`,
    [{ text: 'Cancel', style: 'cancel' }, {
      text: 'Remove', style: 'destructive',
      onPress: () => friendAPI.unfriend(friendId).then(() => navigation.goBack()),
    }],
  );

  if (loading || !profile) return (
    <View style={styles.loading}><ActivityIndicator size="large" color="#3B82F6" /></View>
  );

  const { user, stats, logDates = [] } = profile;
  const name = user?.name || friend?.name || 'Friend';
  const first = name.split(' ')[0];
  const successRate = stats.totalHabits === 0 ? 0
    : Math.round((stats.completedToday / stats.totalHabits) * 100);

  const titles = {
    all: `${first}'s Habits`,
    completed: `Completed by ${first}`,
    missed: `${first}'s Pending`,
    streak: `${first}'s Longest Streak`,
  };
  const emptyMsg = {
    all: 'No habits to show yet.',
    completed: `${first} hasn't completed any habits today yet.`,
    missed: `${first} is all caught up for today.`,
    streak: 'No active streaks yet.',
  };

  const onStat = (key) => {
    setFilter(key);

    // allows react to commit new filter before measure/scroll
    setTimeout(() => scrollRef.current?.scrollTo({
      y: Math.max(0, habitsY.current - 20), animated: true,
    }), 50);
  };

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Friend Profile</Text>
        <View style={styles.identityRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.name}>{name}</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Today's Progress</Text>
          <Text style={styles.percent}>{successRate}%</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${successRate}%` }]} /></View>
        <Text style={styles.fraction}>{stats.completedToday} of {stats.totalHabits} habits completed</Text>
      </View>

      <ActivityHeatmap logDates={logDates} />

      <View style={styles.statRow}>
        <Stat icon="list-outline" color="#3B82F6" value={stats.totalHabits} label="Total Habits"
          active={filter === 'all'} onPress={() => onStat('all')} />
        <Stat icon="checkmark-done-outline" color="#10B981" value={stats.completedToday} label="Completed Today"
          active={filter === 'completed'} onPress={() => onStat('completed')} />
      </View>
      <View style={styles.statRow}>
        <Stat icon="close-circle-outline" color="#EF4444" value={stats.failedToday} label="Missed Today"
          active={filter === 'missed'} onPress={() => onStat('missed')} />
        <Stat icon="flame-outline" color="#F59E0B" value={stats.longestStreak} label="Longest Streak"
          active={filter === 'streak'} onPress={() => onStat('streak')} />
      </View>

      <View style={styles.sectionRow} onLayout={(e) => { habitsY.current = e.nativeEvent.layout.y; }}>
        <Text style={styles.section}>{titles[filter]}</Text>
        {filter !== 'all' && (
          <TouchableOpacity onPress={() => setFilter('all')} style={styles.clearPill} activeOpacity={0.7}>
            <Text style={styles.clearText}>Show all</Text>
          </TouchableOpacity>
        )}
      </View>
      {filteredHabits.length === 0 ? <Text style={styles.empty}>{emptyMsg[filter]}</Text> : (
        <View style={styles.list}>
          {filteredHabits.map((h) => (
            <View key={h.HabitID} style={styles.habitRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.habitName}>{h.HabitName}</Text>
                <Text style={styles.habitMeta}>
                  {h.HabitDescription}{h.Streak ? ` • ${h.Streak} day streak` : ''}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: h.completedToday ? '#DCFCE7' : '#F1F5F9' }]}>
                <Ionicons name={h.completedToday ? 'checkmark' : 'time-outline'} size={14}
                  color={h.completedToday ? '#10B981' : '#64748B'} />
                <Text style={[styles.pillText, { color: h.completedToday ? '#10B981' : '#64748B' }]}>
                  {h.completedToday ? 'Done' : 'Pending'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.unfriend} onPress={unfriend} activeOpacity={0.8}>
        <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
        <Text style={styles.unfriendText}>Remove friend</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ icon, color, value, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[styles.statCard, active && { borderWidth: 2, borderColor: color, padding: 12 }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 24, paddingBottom: 60 },

  headerBlock: { marginBottom: 24, marginTop: 8 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 26, fontWeight: '700', color: '#475569' },
  name: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  email: { fontSize: 14, color: '#64748B', marginTop: 2 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  percent: { fontSize: 18, fontWeight: '800', color: '#3B82F6' },
  track: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  fraction: { fontSize: 13, color: '#64748B', marginTop: 10, fontWeight: '500' },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 2 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 },
  section: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2 },
  clearPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  clearText: { fontSize: 11, fontWeight: '700', color: '#475569', marginLeft: 4 },

  list: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16 },
  habitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  habitName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  habitMeta: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 4 },
  pillText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },

  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginVertical: 8 },

  unfriend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, marginTop: 24, gap: 8, borderWidth: 1, borderColor: '#FECACA' },
  unfriendText: { color: '#EF4444', fontSize: 15, fontWeight: '700', marginLeft: 6 },
});
