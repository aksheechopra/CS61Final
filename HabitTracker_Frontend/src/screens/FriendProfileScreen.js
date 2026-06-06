import { View, Text, Button, StyleSheet } from 'react-native';

export default function FriendProfileScreen() {

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      <Text style={{ marginBottom: 20 }}>Friends Profile (View?) will be here.</Text>
    </View>
  );
}
const styles = StyleSheet.create({ 
  container: { flex: 1, padding: 20, paddingTop: 60, alignItems: 'center' }, 
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 }
});