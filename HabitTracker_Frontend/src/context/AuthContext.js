import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check encrypted storage for a token when the app loads
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) setUserToken(token);
      } catch (e) {
        console.error("Token restore failed", e);
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { token } = response.data;
      
      // Save token securely on the device
      await SecureStore.setItemAsync('userToken', token);
      setUserToken(token);
    } catch (error) {
      throw error;
    }
  };

  const register = async (firstName, lastName, email, password) => {
    try {
      const response = await authAPI.register({
        FirstName: firstName,
        LastName: lastName,
        Email: email,
        Password: password,
      });
      const { token } = response.data;

      // Log the user in immediately after registering
      await SecureStore.setItemAsync('userToken', token);
      setUserToken(token);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout(); 
    } catch (e) {
      console.error(e);
    } finally {
      // Delete the token
      await SecureStore.deleteItemAsync('userToken');
      setUserToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ userToken, login, logout, register, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};