# SETUP INSTRUCTIONS
Note that we downgraded from newest Expo SDK 56 to SDK 54 so that testing is supported by Expo Go mobile app

## Install Packages
```
npm install @react-navigation/native@^6.1.9 @react-navigation/native-stack@^6.9.17
npx expo install react-native-screens react-native-safe-area-context

npx expo install react-native-gesture-handler

npx expo install expo-secure-store expo-haptics

npx expo install @expo/vector-icons
npm install react-native-confetti-cannon
```

## Might ask you to install ngrok
```
npm install @expo/ngrok --save-dev
```

## Start Project
```
npx expo start -c --tunnel 
```