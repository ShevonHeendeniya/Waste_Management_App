
import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './screens/LoginScreen';
import PublicDashboard from './screens/PublicDashboard';
import AdminDashboard from './screens/AdminDashboard';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
    console.log('User logged out');
  };

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2E7D32',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ 
            title: 'Waste Management Login',
            headerShown: false
          }}
        />
        <Stack.Screen 
          name="PublicDashboard" 
          options={{ 
            title: 'Public Dashboard',
            headerLeft: null,
            gestureEnabled: false
          }}
        >
          {(props) => (
            <PublicDashboard 
              {...props} 
              onLogout={() => {
                handleLogout();
                props.navigation.navigate('Login');
              }} 
            />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboard}
          options={{ 
            title: 'Admin Dashboard',
            headerLeft: null,
            gestureEnabled: false
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}