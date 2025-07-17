const API_BASE_URL = 'http://172.20.10.3:3002/api';

// API Helper functions
const apiCall = async (endpoint, options = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🌐 API Call:', url); // Debug log
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: 10000, // 10 second timeout
      ...options,
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    console.log('✅ API Success:', endpoint); // Debug log
    return data;
  } catch (error) {
    console.error('❌ API Error:', error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  login: (email, password, userType) => 
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, userType }),
    }),
    
  register: (email, password, name) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
};

// Bins API
export const binsAPI = {
  getAll: () => apiCall('/bins'),
  getById: (binId) => apiCall(`/bins/${binId}`),
  updateLevel: (binId, level) =>
    apiCall(`/bins/${binId}/update-level`, {
      method: 'POST',
      body: JSON.stringify({ level }),
    }),
};

// Notices API
export const noticesAPI = {
  getAll: () => apiCall('/notices'),
  create: (title, content, adminId, priority = 'medium') =>
    apiCall('/notices', {
      method: 'POST',
      body: JSON.stringify({ title, content, adminId, priority }),
    }),
};

// Reports API
export const reportsAPI = {
  getAll: (status = null) => {
    const endpoint = status ? `/reports?status=${status}` : '/reports';
    return apiCall(endpoint);
  },
  create: (reportType, description, location = null, binId = null, reportedBy = null) =>
    apiCall('/reports', {
      method: 'POST',
      body: JSON.stringify({ reportType, description, location, binId, reportedBy }),
    }),
  resolve: (reportId, resolvedBy) =>
    apiCall(`/reports/${reportId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolvedBy }),
    }),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () => apiCall('/analytics/dashboard'),
};

export default {
  auth: authAPI,
  bins: binsAPI,
  notices: noticesAPI,
  reports: reportsAPI,
  analytics: analyticsAPI,
};