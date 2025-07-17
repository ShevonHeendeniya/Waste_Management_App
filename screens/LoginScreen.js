import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView, // Added ScrollView for better layout on smaller screens
} from 'react-native';
import { authAPI } from '../services/api'; // Assuming you have a register method in authAPI

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('public');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // New state to toggle between login/register

  // New state variables for registration
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nic, setNic] = useState('');
  const [address, setAddress] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Added for registration password confirmation

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Try database authentication first
      const response = await authAPI.login(email, password, userType);

      if (response.success) {
        const userData = response.user;

        // Navigate based on user type
        if (userData.userType === 'admin') {
          navigation.navigate('AdminDashboard', { user: userData });
        } else {
          navigation.navigate('PublicDashboard', { user: userData });
        }
      }
    } catch (error) {
      console.error('Database login error:', error);

      // Fallback to hardcoded credentials for demo
      if (userType === 'admin' && email === 'admin@dhmc.lk' && password === 'admin123') {
        const demoAdmin = {
          id: 'demo_admin',
          email: 'admin@dhmc.lk',
          name: 'Demo Admin',
          userType: 'admin'
        };
        navigation.navigate('AdminDashboard', { user: demoAdmin });
      } else if (userType === 'public') {
        const demoUser = {
          id: 'demo_user',
          email: email,
          name: 'Demo User',
          userType: 'public'
        };
        navigation.navigate('PublicDashboard', { user: demoUser });
      } else {
        Alert.alert('Login Failed', 'Invalid credentials. Try admin@dhmc.lk / admin123 for admin access.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword || !firstName || !lastName || !phoneNumber || !nic || !address) {
      Alert.alert('Error', 'Please fill all registration fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Assuming authAPI has a register method
      const response = await authAPI.register({
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        nic,
        address,
        userType: 'public', // New registered users are typically public users
      });

      if (response.success) {
        Alert.alert('Success', 'Registration successful! You can now log in.');
        setIsRegistering(false); // Switch back to login view after successful registration
        // Optionally pre-fill email field with registered email
        setEmail(email);
        setPassword('');
        setConfirmPassword('');
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        setNic('');
        setAddress('');
      } else {
        Alert.alert('Registration Failed', response.message || 'Something went wrong during registration.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Registration Failed', 'An error occurred during registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Waste Management System</Text>
      <Text style={styles.subtitle}>Dehiwala Municipal Council</Text>

      <View style={styles.userTypeContainer}>
        <TouchableOpacity
          style={[styles.userTypeButton, userType === 'public' && styles.activeUserType]}
          onPress={() => {
            setUserType('public');
            setIsRegistering(false); // Reset to login when switching to public user type
          }}
        >
          <Text style={[styles.userTypeText, userType === 'public' && styles.activeText]}>
            Public User
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.userTypeButton, userType === 'admin' && styles.activeUserType]}
          onPress={() => {
            setUserType('admin');
            setIsRegistering(false); // Admins don't register this way, so switch to login
          }}
        >
          <Text style={[styles.userTypeText, userType === 'admin' && styles.activeText]}>
            Municipal Admin
          </Text>
        </TouchableOpacity>
      </View>

      {isRegistering ? (
        // Registration Panel
        <>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="NIC"
            value={nic}
            onChangeText={setNic}
            autoCapitalize="characters"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Registering...' : 'Register'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegistering(false)} style={styles.switchFormButton}>
            <Text style={styles.switchFormButtonText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </>
      ) : (
        // Login Panel
        <>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {userType === 'public' && ( // Only show register option for public users
            <TouchableOpacity onPress={() => setIsRegistering(true)} style={styles.switchFormButton}>
              <Text style={styles.switchFormButtonText}>Don't have an account? Register</Text>
            </TouchableOpacity>
          )}

          {userType === 'admin' && (
            <Text style={styles.adminNote}>
              Admin Login: admin@dhmc.lk / admin123
            </Text>
          )}

          <Text style={styles.demoNote}>
            Demo: Any email/password works for public users (if DB login fails)
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Use flexGrow instead of flex: 1 with ScrollView
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2E7D32',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 5,
    overflow: 'hidden',
  },
  userTypeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
  },
  activeUserType: {
    backgroundColor: '#2E7D32',
  },
  userTypeText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeText: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adminNote: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    color: '#666',
  },
  demoNote: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  switchFormButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchFormButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: 'bold',
  },
});