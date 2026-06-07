import 'react-native-gesture-handler';
import React, { useContext } from 'react';
import { ActivityIndicator, View, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import HabitDetailsScreen from './src/screens/HabitDetailsScreen';
import AddHabitScreen from './src/screens/AddHabitScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import FriendsScreen from './src/screens/FriendsScreen';

import FriendProfileScreen from './src/screens/FriendProfileScreen'; 

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();


// custom tab bar so that the top tab navigator looks like a bottom one. (needed this for swiping functionality)
function BottomTabBar({ state, navigation }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.tabBarSafeArea}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const color = focused ? '#3B82F6' : '#94A3B8';

          let iconName = 'ellipse';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Profile') iconName = 'stats-chart';
          else if (route.name === 'Friends') iconName = 'people';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <Ionicons name={iconName} size={24} color={color} />
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

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


// allows users to swipe between tabs
function MainTabs() {
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
      }}
    >
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

const styles = StyleSheet.create({
  tabBarSafeArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tabBar: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#FFFFFF',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});