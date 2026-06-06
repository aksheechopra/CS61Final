import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function CalendarScreen() {
  const { logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      <Text style={{ marginBottom: 20 }}>User Profile view goes here.</Text>
      
      <Button title="Logout" onPress={logout} color="red" />
    </View>
  );
}
const styles = StyleSheet.create({ 
  container: { flex: 1, padding: 20, paddingTop: 60, alignItems: 'center' }, 
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 }
});