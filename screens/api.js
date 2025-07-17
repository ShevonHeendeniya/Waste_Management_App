const API_BASE_URL = 'http://172.20.10.3:3002/api';

export const authAPI = {
  login: async (email, password, userType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, userType }),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};