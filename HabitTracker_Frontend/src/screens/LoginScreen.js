import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';

/*
User Onboarding Screen
- Login with email + password
- Register with first name, last name, email, password
  Calls POST /register (public endpoint) and logs the user in immediately.
*/

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Shared fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register-only fields
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');

  const [loading, setLoading] = useState(false);

  const { login, register } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return Alert.alert('Required', 'Please enter your email and password.');
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      const msg = error?.response?.data?.error || 'Invalid credentials. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      return Alert.alert('Required', 'Please fill in all fields.');
    }
    if (password.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      await register(firstName.trim(), lastName.trim(), email.trim(), password);
      // AuthContext sets the token → app navigator switches to the main stack automatically
    } catch (error) {
      const msg = error?.response?.data?.error || 'Could not create account. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => (m === 'login' ? 'register' : 'login'));
    // Clear fields when switching so nothing bleeds across
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
  };

  const isLogin = mode === 'login';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Header */}
          <Text style={styles.appName}>HabitTracker</Text>
          <Text style={styles.subtitle}>{isLogin ? 'Welcome back' : 'Create your account'}</Text>

          {/* Register-only name fields */}
          {!isLogin && (
            <View style={styles.row}>
              <View style={[styles.inputWrap, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jane"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Doe"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          {/* Shared fields */}
          <View style={styles.inputWrap}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder={isLogin ? '••••••••' : 'Min. 6 characters'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Primary action */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={isLogin ? handleLogin : handleRegister}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? '…' : isLogin ? 'Log In' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Switch mode */}
          <View style={styles.switchRow}>
            <Text style={styles.switchPrompt}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={switchMode} activeOpacity={0.7}>
              <Text style={styles.switchLink}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },

  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 28,
  },

  row: { flexDirection: 'row', marginBottom: 0 },

  inputWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },

  primaryBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchPrompt: { fontSize: 14, color: '#64748B' },
  switchLink: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },
});