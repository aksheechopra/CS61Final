import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { habitAPI, logAPI } from '../api';

/* 
Habit Detail Screen
Includes the following functionality so far:

1) Update Habit name/ description
2) See logs for habit
*/

export default function HabitDetailsScreen({ route, navigation }) {

  // Get the selected habit ID passed from the previous screen
  const habitId = route?.params?.habitId;
  
  const [habit, setHabit] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Form fields that can be used to edit the habit
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!habitId) {
      Alert.alert("Error", "No Habit ID provided.");
      navigation.goBack();
      return;
    }

    const loadData = async () => {
      try {
        // Fetch the habit details and completion history
        const habitRes = await habitAPI.getHabit(habitId);
        const logsRes = await logAPI.getLogs(habitId);
        
        setHabit(habitRes.data);
        
        // helps keep reads and writes concistent
        setName(habitRes.data.HabitName || '');
        setDescription(habitRes.data.HabitDescription || '');
        setLogs(logsRes.data || []);
      } catch (error) {
        Alert.alert("Error", "Failed to load details");
      }
    };
    loadData();
  }, [habitId]);

  const handleUpdate = async () => {
    try {
      // Save any edits made to the habits
      await habitAPI.updateHabit(habitId, {
        HabitName: name,
        HabitDescription: description,
        Status: habit?.Status
      });
      Alert.alert("Success", "Habit updated!");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Could not update habit.");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete habit',
      `Delete "${habit?.HabitName || 'this habit'}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await habitAPI.deleteHabit(habitId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', 'Could not delete habit.');
            }
          },
        },
      ]
    );
  };

  // loading screen
  if (!habit) return <Text style={{padding: 20}}>Loading...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Edit Habit Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      
      <Text style={styles.label}>Edit Description</Text>
      <TextInput style={[styles.input, { height: 80 }]} multiline value={description} onChangeText={setDescription} />

      <Button title="Save Changes" onPress={handleUpdate} />

      <Text style={styles.sectionTitle}>Completion History</Text>
      <FlatList
        data={logs}
        keyExtractor={(item, index) => (item?.id || item?._id || index).toString()}
        renderItem={({ item }) => (
          <View style={styles.logBox}>
            <Text>Logged: {item?.date ? new Date(item.date).toLocaleDateString() : 'Unknown Date'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No logs yet. Swipe left on home screen to complete!</Text>}
      />

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={18} color="#EF4444" />
        <Text style={styles.deleteButtonText}>Delete Habit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginTop: 5, marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 25, marginBottom: 10 },
  logBox: { padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 10 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700', marginLeft: 6 },
});