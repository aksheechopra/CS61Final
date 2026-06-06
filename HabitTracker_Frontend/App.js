import 'react-native-gesture-handler'; 
import React, { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; 

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import HabitDetailsScreen from './src/screens/HabitDetailsScreen';
import AddHabitScreen from './src/screens/AddHabitScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import FriendsScreen from './src/screens/FriendsScreen';

import FriendProfileScreen from './src/screens/FriendProfileScreen'; 

/*
Controls layout of App and Routing
*/

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ 
      backgroundColor: '#FFFFFF',
      borderTopColor: '#F1F5F9',
      elevation: 0,
      shadowOpacity: 0,
      headerTitleStyle: { fontWeight: '700' },
      headerShadowVisible: true
    }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'My Habits' }} />
      <Stack.Screen name="HabitDetails" component={HabitDetailsScreen} options={{ title: 'Habit Details' }} />
      <Stack.Screen name="AddHabit" component={AddHabitScreen} options={{ title: 'New Habit' }} />
    </Stack.Navigator>
  );
}

function FriendsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ 
      backgroundColor: '#FFFFFF',
      borderTopColor: '#F1F5F9',
      elevation: 0,
      shadowOpacity: 0,
      headerTitleStyle: { fontWeight: '700' },
      headerShadowVisible: true
    }}>
      <Stack.Screen 
        name="FriendsMain" 
        component={FriendsScreen} 
        options={{ title: 'Community' }} 
      />
      <Stack.Screen 
        name="FriendProfile" 
        component={FriendProfileScreen} 
        options={({ route }) => ({ 
          title: `${route.params.friend.name.split(' ')[0]}'s Profile`
        })} 
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        let iconName;
        if (route.name === 'Home') iconName = 'home';
        else if (route.name === 'Profile') iconName = 'stats-chart';
        else if (route.name === 'Friends') iconName = 'people';
        
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      headerShown: false, 
      tabBarStyle: {
        backgroundColor: '#FFFFFF',
        borderTopColor: '#F1F5F9',
        elevation: 0,
        shadowOpacity: 0,
      }
    })}>
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Profile" component={CalendarScreen} />
      <Tab.Screen name="Friends" component={FriendsStackNavigator} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { userToken, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}