import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { habitAPI } from '../api';

/* 
Add Habit Screen
Includes the following functionality so far:

1) Create a new habit to track
*/

export default function AddHabitScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert("Required", "Habit name cannot be empty.");
    
    try {
      await habitAPI.createHabit({ 
        habitName: name, 
        HabitDescription: description, 
        status: 'active' 
      });
      navigation.goBack(); // Return to home screen after saving
    } catch (error) {
      Alert.alert("Error", "Could not create habit.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Habit Name</Text>
      <TextInput style={styles.input} placeholder="e.g., Drink Water" value={name} onChangeText={setName} />
      
      <Text style={styles.label}>Description (Optional)</Text>
      <TextInput style={[styles.input, { height: 80 }]} multiline placeholder="e.g., Drink 8 glasses daily" value={description} onChangeText={setDescription} />

      <Button title="Create Habit" onPress={handleCreate} color="#1A535C" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 20 }
});