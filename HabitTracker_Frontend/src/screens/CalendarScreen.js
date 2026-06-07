import React, { useContext, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { AuthContext } from '../context/AuthContext';
import { userAPI, habitAPI, logAPI, friendAPI } from '../api';
import ActivityHeatmap from '../components/ActivityHeatmap';

export default function CalendarScreen() {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation();

  const titles = {
    all: 'Your Habits',
    completed: 'Completed Today',
    missed: 'Missed Today',
    streak: 'Longest Streak',
  };
  const emptyMsg = {
    all: 'No habits yet - add one from the Home tab.',
    completed: "You haven't completed any habits today yet.",
    missed: "Nothing missed - you're all caught up!",
    streak: 'No active streaks yet.',
  };

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [habits, setHabits] = useState([]);
  const [logDates, setLogDates] = useState([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [filter, setFilter] = useState('all');

  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef(null);
  const habitsY = useRef(0);

  const loadProfile = async () => {
    const [meRes, habitsRes, friendsRes] = await Promise.all([
      userAPI.getMe(), habitAPI.getMyHabits(), friendAPI.getFriends(),
    ]);
    const today = new Date().toDateString();
    const enriched = await Promise.all((habitsRes.data || []).map(async (h) => {
      const logs = (await logAPI.getLogs(h.HabitID)).data || [];
      return {
        ...h,
        logCount: logs.length,
        completedToday: logs.some(l => new Date(l.DateLogged).toDateString() === today),
        logDates: logs.map(l => new Date(l.DateLogged)),
      };
    }));
    setMe(meRes.data);
    setHabits(enriched);
    setLogDates(enriched.flatMap(h => h.logDates));
    setFriendsCount((friendsRes.data || []).length);
    setLoading(false);
  };


  // don't reset 'loading' on re-focus and instead let first mount handle it
  useFocusEffect(useCallback(() => { loadProfile().catch(() => {
    Alert.alert('Error', 'Could not load your profile.');
    setLoading(false);
  }); }, []));

  const totalHabits = habits.length;
  const completedToday = habits.filter(h => h.completedToday).length;
  const missedToday = totalHabits - completedToday;
  const longestStreak = habits.reduce((m, h) => Math.max(m, h.Streak || 0), 0);
  const successRate = totalHabits === 0 ? 0 : Math.round((completedToday / totalHabits) * 100);

  const filteredHabits = useMemo(() => {
    if (filter === 'completed') return habits.filter(h => h.completedToday);
    if (filter === 'missed') return habits.filter(h => !h.completedToday);
    if (filter === 'streak') {
      const max = longestStreak;
      return max === 0 ? [] : habits.filter(h => (h.Streak || 0) === max);
    }
    return habits;
  }, [habits, filter, longestStreak]);

  const onStat = (key) => {
    if (key === 'friends') return navigation.navigate('Friends');
    setFilter(key);
    
    // allows React to commit new filter before measu and scroll
    setTimeout(() => scrollRef.current?.scrollTo({
      y: Math.max(0, habitsY.current - 20), animated: true,
    }), 50);
  };

  const openEdit = () => {
    setEditName(me?.Name || '');
    setEditEmail(me?.Email || '');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    const name = editName.trim(), email = editEmail.trim();
    if (!name || !email) return Alert.alert('Missing info', 'Name and email are required.');
    setSaving(true);
    try {
      const res = await userAPI.updateMe({ Name: name, Email: email });
      setMe(res.data);
      setEditVisible(false);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const deleteHabit = (h) => Alert.alert(
    'Delete habit', `Delete "${h.HabitName}"? This can't be undone.`,
    [{ text: 'Cancel', style: 'cancel' }, {
      text: 'Delete', style: 'destructive',
      onPress: () => habitAPI.deleteHabit(h.HabitID).then(loadProfile),
    }],
  );

  const confirmLogout = () => Alert.alert(
    'Log out', 'Are you sure you want to log out?',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logout }],
  );

  if (loading) return (
    <View style={styles.loading}><ActivityIndicator size="large" color="#3B82F6" /></View>
  );

  const name = me?.Name || 'You';

  return (
    <>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>Profile</Text>
            <TouchableOpacity onPress={openEdit} style={styles.editButton} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={14} color="#3B82F6" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.identityRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.name}>{name}</Text>
              {me?.Email ? <Text style={styles.email}>{me.Email}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle}>Today's Progress</Text>
            <Text style={styles.percent}>{successRate}%</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${successRate}%` }]} /></View>
          <Text style={styles.fraction}>{completedToday} of {totalHabits} habits completed</Text>
        </View>

        <ActivityHeatmap logDates={logDates} />

        <View style={styles.statRow}>
          <Stat icon="list-outline" color="#3B82F6" value={totalHabits} label="Total Habits"
            active={filter === 'all'} onPress={() => onStat('all')} />
          <Stat icon="checkmark-done-outline" color="#10B981" value={completedToday} label="Completed Today"
            active={filter === 'completed'} onPress={() => onStat('completed')} />
          <Stat icon="close-circle-outline" color="#EF4444" value={missedToday} label="Missed Today"
            active={filter === 'missed'} onPress={() => onStat('missed')} />
        </View>
        <View style={styles.statRowCentered}>
          <Stat icon="flame-outline" color="#F59E0B" value={longestStreak} label="Longest Streak"
            active={filter === 'streak'} onPress={() => onStat('streak')} />
          <Stat icon="people-outline" color="#8B5CF6" value={friendsCount} label="Friends"
            onPress={() => onStat('friends')} />
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
                    {h.logCount} {h.logCount === 1 ? 'completion' : 'completions'}
                    {h.Streak ? ` • ${h.Streak} day streak` : ''}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: h.completedToday ? '#DCFCE7' : '#F1F5F9' }]}>
                  <Ionicons name={h.completedToday ? 'checkmark' : 'time-outline'} size={14}
                    color={h.completedToday ? '#10B981' : '#64748B'} />
                  <Text style={[styles.pillText, { color: h.completedToday ? '#10B981' : '#64748B' }]}>
                    {h.completedToday ? 'Done' : 'Pending'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteHabit(h)} style={styles.trash}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.6}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Edit Profile</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName}
              placeholder="Your name" placeholderTextColor="#94A3B8" autoCapitalize="words" />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail}
              placeholder="you@example.com" placeholderTextColor="#94A3B8"
              autoCapitalize="none" keyboardType="email-address" />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setEditVisible(false)} activeOpacity={0.7}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveEdit} disabled={saving} activeOpacity={0.7}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Stat({ icon, color, value, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      // making sure card doesn't grow
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
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 120 },

  headerBlock: { marginBottom: 24 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2 },
  editButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 4 },
  editButtonText: { color: '#3B82F6', fontSize: 12, fontWeight: '700', marginLeft: 4 },
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
  statRowCentered: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  statCard: { width: '31%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
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
  trash: { marginLeft: 10, padding: 4 },

  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginVertical: 8 },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, marginTop: 24, gap: 8, borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700', marginLeft: 6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 20, letterSpacing: -0.5 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#0F172A', marginBottom: 16 },
  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  btnSecondary: { backgroundColor: '#F1F5F9' },
  btnSecondaryText: { color: '#475569', fontSize: 15, fontWeight: '700' },
  btnPrimary: { backgroundColor: '#3B82F6' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
