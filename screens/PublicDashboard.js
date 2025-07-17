import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';

// Multi-source API configuration with ESP32 integration
const API_ENDPOINTS = {
  ADMIN_API: 'http://172.20.10.3:3002/api',
  ESP32_DIRECT: 'http://172.20.10.14', // ESP32's IP from your serial monitor
  ESP32_API: 'http://172.20.10.3:3002/api/bins/DHW001/update-level' // Admin API endpoint for ESP32 data
};

// Enhanced API service with ESP32 integration
const binsAPI = {
  getAll: async () => {
    console.log('🔍 Starting multi-source data fetch...');
    
    const dataSources = [
      // Try admin API first
      {
        name: 'Admin API',
        fetch: async () => {
          const response = await fetch(`${API_ENDPOINTS.ADMIN_API}/bins`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        }
      },
      // Try ESP32 direct connection
      {
        name: 'ESP32 Direct',
        fetch: async () => {
          const response = await fetch(`${API_ENDPOINTS.ESP32_DIRECT}/bins`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 3000,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        }
      }
    ];

    // Try each data source
    for (const source of dataSources) {
      try {
        console.log(`🔄 Trying ${source.name}...`);
        const data = await source.fetch();
        console.log(`✅ Success with ${source.name}:`, data);
        
        // Ensure data is in array format
        const binsArray = Array.isArray(data) ? data : (data.bins || [data]);
        return { data: binsArray, source: source.name };
      } catch (error) {
        console.log(`❌ ${source.name} failed:`, error.message);
      }
    }

    // If all sources fail, throw error
    throw new Error('All data sources failed');
  }
};

const noticesAPI = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN_API}/notices`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { data: Array.isArray(data) ? data : (data.notices || []) };
    } catch (error) {
      console.error('Notices API Error:', error);
      return { data: [] };
    }
  }
};

const reportsAPI = {
  create: async (reportData) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN_API}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Reports API Error:', error);
      throw error;
    }
  }
};

export default function PublicDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('bins');
  const [bins, setBins] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedBin, setSelectedBin] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportType, setReportType] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [dataSource, setDataSource] = useState('unknown');
  
  const autoRefreshInterval = useRef(null);

  useEffect(() => {
    loadInitialData();
    getUserLocation();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      console.log('🔄 Starting auto-refresh for ESP32 integration...');
      autoRefreshInterval.current = setInterval(() => {
        refreshData();
      }, 15000); // Refresh every 15 seconds for ESP32 data
    } else {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        console.log('⏹️ Stopping auto-refresh...');
      }
    }

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [autoRefresh]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
        console.log('📍 User location obtained:', location.coords);
      }
    } catch (error) {
      console.log('Location permission denied');
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    setConnectionStatus('loading');
    try {
      console.log('🚀 Loading initial data with ESP32 integration...');
      await Promise.all([
        loadBins(),
        loadNotices()
      ]);
      setConnectionStatus('success');
      console.log('✅ Initial data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
      setConnectionStatus('error');
      // Use fallback data if everything fails
      const fallbackData = getFallbackBinsData();
      setBins(fallbackData);
      setDataSource('fallback');
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  const refreshData = async () => {
    try {
      setConnectionStatus('loading');
      console.log('🔄 Refreshing data...');
      await Promise.all([
        loadBins(),
        loadNotices()
      ]);
      setLastUpdate(new Date());
      setConnectionStatus('success');
      console.log('✅ Data refreshed successfully');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      setConnectionStatus('error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const loadBins = async () => {
    try {
      console.log('📦 Loading bins data from multiple sources...');
      const response = await binsAPI.getAll();
      
      if (response.data && response.data.length > 0) {
        // Transform data to ensure compatibility
        const transformedBins = response.data.map(bin => {
          // Handle different data formats from different sources
          const binData = {
            id: bin.id || bin.binId || bin._id || `BIN_${Date.now()}`,
            location_name: bin.location_name || bin.locationName || bin.location?.address || 'ESP32 Sensor Location',
            latitude: parseFloat(bin.latitude || bin.location?.latitude || 6.8519),
            longitude: parseFloat(bin.longitude || bin.location?.longitude || 79.8774),
            fill_level: parseInt(bin.fill_level || bin.fillLevel || bin.level || bin.distance ? calculateFillFromDistance(bin.distance) : 0),
            bin_type: bin.bin_type || bin.binType || bin.type || 'General Waste',
            last_updated: bin.last_updated || bin.lastUpdated || bin.updatedAt || new Date().toISOString(),
            sensor_distance: bin.sensor_distance || bin.sensorDistance || bin.distance || null,
            battery_level: bin.battery_level || bin.batteryLevel || 85,
            status: bin.status || 'active',
            data_source: response.source || 'unknown'
          };

          return binData;
        });

        setBins(transformedBins);
        setDataSource(response.source);
        console.log(`✅ Loaded ${transformedBins.length} bins from ${response.source}:`, transformedBins);
        return transformedBins;
      } else {
        console.log('⚠️ No bins data received, using fallback');
        const fallbackData = getFallbackBinsData();
        setBins(fallbackData);
        setDataSource('fallback');
        return fallbackData;
      }
    } catch (error) {
      console.error('❌ Error loading bins:', error);
      // Use fallback data when all APIs fail
      const fallbackData = getFallbackBinsData();
      setBins(fallbackData);
      setDataSource('fallback');
      throw error;
    }
  };

  // Convert ultrasonic sensor distance to fill level percentage
  const calculateFillFromDistance = (distance) => {
    const BIN_HEIGHT = 100; // cm - adjust based on your bin height
    const MAX_DISTANCE = 100; // cm - maximum sensor distance
    
    if (!distance || distance <= 0) return 0;
    if (distance >= MAX_DISTANCE) return 0;
    
    // Convert distance to fill level (closer distance = higher fill level)
    const fillLevel = Math.max(0, Math.min(100, 100 - (distance / BIN_HEIGHT * 100)));
    return Math.round(fillLevel);
  };

  // Enhanced fallback data with realistic ESP32 simulation
  const getFallbackBinsData = () => {
    return [
      {
        id: 'DHW001',
        location_name: 'Dehiwala Center (ESP32)',
        latitude: 6.8519,
        longitude: 79.8774,
        fill_level: Math.floor(Math.random() * 100),
        bin_type: 'General Waste',
        last_updated: new Date().toISOString(),
        sensor_distance: Math.floor(Math.random() * 90 + 10),
        battery_level: Math.floor(Math.random() * 50 + 50),
        status: 'active',
        data_source: 'fallback'
      },
      {
        id: 'DHW002',
        location_name: 'Market Square (ESP32)',
        latitude: 6.8545,
        longitude: 79.8796,
        fill_level: Math.floor(Math.random() * 100),
        bin_type: 'Recyclable',
        last_updated: new Date().toISOString(),
        sensor_distance: Math.floor(Math.random() * 90 + 10),
        battery_level: Math.floor(Math.random() * 50 + 50),
        status: 'active',
        data_source: 'fallback'
      },
      {
        id: 'DHW003',
        location_name: 'Hospital Entrance (ESP32)',
        latitude: 6.8501,
        longitude: 79.8821,
        fill_level: Math.floor(Math.random() * 100),
        bin_type: 'Medical Waste',
        last_updated: new Date().toISOString(),
        sensor_distance: Math.floor(Math.random() * 90 + 10),
        battery_level: Math.floor(Math.random() * 50 + 50),
        status: 'active',
        data_source: 'fallback'
      }
    ];
  };

  const loadNotices = async () => {
    try {
      console.log('📢 Loading notices...');
      const response = await noticesAPI.getAll();
      setNotices(response.data || []);
      console.log(`✅ Loaded ${response.data?.length || 0} notices`);
    } catch (error) {
      console.error('❌ Failed to load notices:', error);
      setNotices([]);
    }
  };

  const getBinStatusColor = (level) => {
    if (level >= 90) return '#F44336'; // Red
    if (level >= 70) return '#FF9800'; // Orange
    if (level >= 50) return '#FFC107'; // Yellow
    return '#4CAF50'; // Green
  };

  const getBinStatusText = (level) => {
    if (level >= 90) return 'CRITICAL';
    if (level >= 80) return 'FULL';
    if (level >= 50) return 'HALF FULL';
    return 'AVAILABLE';
  };

  const getBinRecommendation = (level, binType) => {
    if (level >= 90) {
      return `🚨 CRITICAL: ${binType} bin is full! Please find an alternative bin.`;
    }
    if (level >= 70) {
      return `⚠️ HIGH: ${binType} bin is almost full. Consider using another bin.`;
    }
    if (level >= 50) {
      return `📊 MEDIUM: ${binType} bin is half full. Still usable.`;
    }
    return `✅ GOOD: ${binType} bin has plenty of space available.`;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c * 1000).toFixed(0); // Distance in meters
  };

  const openDirections = (bin) => {
    const latitude = parseFloat(bin.latitude);
    const longitude = parseFloat(bin.longitude);
    const label = encodeURIComponent(bin.location_name);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      Alert.alert('Error', 'Location coordinates not available for this bin.');
      return;
    }
    
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        Linking.openURL(webUrl);
      }
    }).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  const openReportModal = (bin, type) => {
    setSelectedBin(bin);
    setReportType(type);
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!reportText.trim()) {
      Alert.alert('Error', 'Please enter report details');
      return;
    }

    try {
      await reportsAPI.create({
        bin_id: selectedBin.id,
        report_type: reportType,
        description: reportText,
        location: selectedBin.location_name,
        submitted_by: 'public_user',
        created_at: new Date().toISOString()
      });

      Alert.alert('Success', 'Report submitted successfully. Municipal team will be notified.');
      setReportModalVisible(false);
      setReportText('');
      setSelectedBin(null);
      setReportType('');
    } catch (error) {
      console.error('Failed to submit report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const handleQuickReport = (binId, reportType) => {
    Alert.alert(
      'Quick Report',
      `Report that bin ${binId} is full?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Report', 
          onPress: async () => {
            try {
              await reportsAPI.create({
                bin_id: binId,
                report_type: 'bin_full',
                description: 'Bin reported as full by public user via ESP32 monitoring',
                location: bins.find(b => b.id === binId)?.location_name || 'Unknown',
                submitted_by: 'public_user',
                created_at: new Date().toISOString()
              });
              Alert.alert('Report Submitted', 'Thank you for reporting. The municipal team will be notified.');
            } catch (error) {
              Alert.alert('Error', 'Failed to submit report. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getQuickStats = () => {
    const totalBins = bins.length;
    const fullBins = bins.filter(bin => bin.fill_level >= 90).length;
    const nearFullBins = bins.filter(bin => bin.fill_level >= 70 && bin.fill_level < 90).length;
    const availableBins = bins.filter(bin => bin.fill_level < 50).length;

    return { totalBins, fullBins, nearFullBins, availableBins };
  };

  const getAlerts = () => {
    return bins.filter(bin => bin.fill_level >= 80).sort((a, b) => b.fill_level - a.fill_level);
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never';
    const now = new Date();
    const diff = Math.floor((now - lastUpdate) / 1000); // seconds
    
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return `${Math.floor(diff / 3600)} hours ago`;
  };

  const renderConnectionStatus = () => {
    const getStatusInfo = () => {
      switch (connectionStatus) {
        case 'success':
          return { color: '#4CAF50', text: 'Live Data', icon: '🟢' };
        case 'loading':
          return { color: '#FF9800', text: 'Updating...', icon: '🟡' };
        case 'error':
          return { color: '#F44336', text: 'Using Fallback', icon: '🔴' };
        default:
          return { color: '#9E9E9E', text: 'Ready', icon: '⚪' };
      }
    };

    const status = getStatusInfo();
    return `${status.icon} ${status.text}`;
  };

  const getDataSourceIcon = (source) => {
    switch (source) {
      case 'Admin API': return '🏢';
      case 'ESP32 Direct': return '📡';
      case 'fallback': return '💾';
      default: return '❓';
    }
  };

  const renderBinsTab = () => {
    const stats = getQuickStats();
    const alerts = getAlerts();
    const sortedBins = bins.sort((a, b) => b.fill_level - a.fill_level);

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#2E7D32']}
          />
        }
      >
        {/* ESP32 Integration Status */}
        <View style={styles.esp32StatusCard}>
          <Text style={styles.esp32StatusTitle}>🔌 ESP32 Integration Status</Text>
          <Text style={styles.esp32StatusText}>
            ESP32 IP: 172.20.10.14
          </Text>
          <Text style={styles.esp32StatusText}>
            Data Source: {getDataSourceIcon(dataSource)} {dataSource}
          </Text>
          <Text style={styles.esp32StatusText}>
            Status: {renderConnectionStatus()}
          </Text>
          <Text style={styles.esp32StatusText}>
            Bins Monitoring: {bins.length}
          </Text>
        </View>

        {/* Real-time Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.statusInfo}>
            <View style={[styles.statusDot, { 
              backgroundColor: connectionStatus === 'success' ? '#4CAF50' : 
                             connectionStatus === 'loading' ? '#FF9800' : '#F44336' 
            }]} />
            <Text style={styles.statusText}>
              {connectionStatus === 'success' ? 'ESP32 Live' : 
               connectionStatus === 'loading' ? 'Syncing...' : 
               connectionStatus === 'error' ? 'Offline Mode' : 'Ready'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.autoRefreshButton, { backgroundColor: autoRefresh ? '#F44336' : '#4CAF50' }]}
            onPress={() => setAutoRefresh(!autoRefresh)}
          >
            <Text style={styles.autoRefreshText}>
              {autoRefresh ? '⏹️ Stop ESP32' : '📡 Start ESP32'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Last Update Info */}
        <View style={styles.lastUpdateInfo}>
          <Text style={styles.lastUpdateText}>
            📡 Last ESP32 Sync: {formatLastUpdate()}
          </Text>
          {autoRefresh && (
            <Text style={styles.autoRefreshInfo}>
              📡 ESP32 auto-sync active - Updates every 15 seconds
            </Text>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatNumber, { color: '#2E7D32' }]}>{stats.totalBins}</Text>
            <Text style={styles.quickStatLabel}>Total Bins</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatNumber, { color: '#F44336' }]}>{stats.fullBins}</Text>
            <Text style={styles.quickStatLabel}>Full</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatNumber, { color: '#FF9800' }]}>{stats.nearFullBins}</Text>
            <Text style={styles.quickStatLabel}>Near Full</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatNumber, { color: '#4CAF50' }]}>{stats.availableBins}</Text>
            <Text style={styles.quickStatLabel}>Available</Text>
          </View>
        </View>

        {/* Priority Alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertSection}>
            <Text style={styles.alertTitle}>🚨 ESP32 Critical Alerts</Text>
            {alerts.slice(0, 3).map((bin, index) => (
              <View key={bin.id} style={styles.alertItem}>
                <Text style={styles.alertLocation}>{bin.location_name}</Text>
                <Text style={styles.alertLevel}>{bin.fill_level}% Full</Text>
              </View>
            ))}
            {alerts.length > 3 && (
              <Text style={styles.additionalInfoText}>
                +{alerts.length - 3} more bins need attention
              </Text>
            )}
          </View>
        )}

        {/* Enhanced Bin List */}
        <Text style={styles.sectionTitle}>📡 ESP32 Monitored Waste Bins</Text>
        
        {bins.length === 0 ? (
          <View style={styles.noBinsContainer}>
            <Text style={styles.noBinsText}>
              {connectionStatus === 'loading' ? 'Connecting to ESP32...' : 'No ESP32 bins detected'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadBins}>
              <Text style={styles.retryButtonText}>📡 Retry ESP32 Connection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sortedBins.map((bin) => {
            const statusColor = getBinStatusColor(bin.fill_level);
            const statusText = getBinStatusText(bin.fill_level);
            const recommendation = getBinRecommendation(bin.fill_level, bin.bin_type);
            const distance = userLocation ? 
              calculateDistance(userLocation.latitude, userLocation.longitude, bin.latitude, bin.longitude) : null;

            return (
              <View key={bin.id} style={styles.enhancedBinCard}>
                {/* Header */}
                <View style={styles.binCardHeader}>
                  <View style={styles.binMainInfo}>
                    <Text style={styles.binLocationName}>
                      {bin.location_name} {getDataSourceIcon(bin.data_source)}
                    </Text>
                    <Text style={styles.binIdText}>ID: {bin.id}</Text>
                    <Text style={styles.binTypeText}>{bin.bin_type} Waste</Text>
                  </View>
                  <View style={styles.binStatusInfo}>
                    <Text style={[styles.binStatusText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                    <Text style={styles.binLevelText}>{bin.fill_level}%</Text>
                  </View>
                </View>

                {/* Fill Level Bar */}
                <View style={styles.fillLevelContainer}>
                  <Text style={styles.fillLevelLabel}>Fill Level:</Text>
                  <View style={styles.fillLevelBar}>
                    <View 
                      style={[
                        styles.fillLevelProgress,
                        { 
                          width: `${bin.fill_level}%`,
                          backgroundColor: statusColor 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.fillLevelPercentage}>{bin.fill_level}%</Text>
                </View>

                {/* Additional Info */}
                <View style={styles.binAdditionalInfo}>
                  <Text style={styles.additionalInfoText}>
                    📍 Location: {bin.location_name}
                  </Text>
                  <Text style={styles.additionalInfoText}>
                    🗂️ Type: {bin.bin_type} Waste Bin
                  </Text>
                  {distance && (
                    <Text style={styles.additionalInfoText}>
                      📏 Distance: ~{distance}m away
                    </Text>
                  )}
                  {bin.sensor_distance && (
                    <Text style={styles.additionalInfoText}>
                      📡 ESP32 Sensor: {bin.sensor_distance}cm, Battery: {bin.battery_level}%
                    </Text>
                  )}
                  <Text style={styles.additionalInfoText}>
                    🕒 Updated: {new Date(bin.last_updated).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.additionalInfoText}>
                    📊 Source: {getDataSourceIcon(bin.data_source)} {bin.data_source}
                  </Text>
                </View>

                {/* Recommendation */}
                <View style={[
                  styles.recommendationBox,
                  bin.fill_level < 30 ? { backgroundColor: '#E8F5E8', borderLeftColor: '#4CAF50' } : {}
                ]}>
                  <Text style={[
                    styles.recommendationText,
                    bin.fill_level < 30 ? { color: '#2E7D32' } : {}
                  ]}>
                    {recommendation}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.binActions}>
                  <TouchableOpacity
                    style={styles.directionsButton}
                    onPress={() => openDirections(bin)}
                  >
                    <Text style={styles.directionsButtonText}>📍 Get Directions</Text>
                  </TouchableOpacity>
                  
                  {bin.fill_level >= 80 ? (
                    <TouchableOpacity
                      style={styles.reportButton}
                      onPress={() => handleQuickReport(bin.id, 'bin_full')}
                    >
                      <Text style={styles.reportButtonText}>📝 Report Full</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.reportButton}
                      onPress={() => openReportModal(bin, 'issue')}
                    >
                      <Text style={styles.reportButtonText}>📝 Report Issue</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* ESP32 Integration Information */}
        <View style={styles.dataSourceInfo}>
          <Text style={styles.dataSourceTitle}>📡 ESP32 Integration Information</Text>
          <Text style={styles.dataSourceText}>
            • Real-time data from ESP32 ultrasonic sensors{'\n'}
            • Direct ESP32 connection: 172.20.10.14{'\n'}
            • Fallback to admin dashboard data{'\n'}
            • Auto-sync every 15 seconds when enabled{'\n'}
            • Distance-based fill level calculation{'\n'}
            • Multi-source data redundancy for reliability
          </Text>
          
          {autoRefresh && (
            <Text style={styles.autoRefreshInfo}>
              📡 ESP32 auto-sync active - Live sensor monitoring
            </Text>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderNoticesTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>📢 Public Notices</Text>
      {notices.length > 0 ? (
        notices.map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={styles.noticeContent}>{notice.content}</Text>
            <Text style={styles.noticeDate}>
              {new Date(notice.created_at).toLocaleDateString()}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.noDataText}>No notices available</Text>
      )}
    </ScrollView>
  );

  const renderReportsTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>📝 Report an Issue</Text>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>How to Report ESP32 Sensor Issues:</Text>
        <Text style={styles.infoText}>
          1. Go to the "Bins" tab and find the problematic ESP32 bin
        </Text>
        <Text style={styles.infoText}>
          2. Tap "Report Issue" or "Report Full" on the bin card
        </Text>
        <Text style={styles.infoText}>
          3. Provide details about the sensor or bin issue
        </Text>
        <Text style={styles.infoText}>
          4. Submit your report - it will be sent to the admin dashboard
        </Text>
      </View>

      <View style={styles.reportTypeContainer}>
        <Text style={styles.reportTypeTitle}>Common ESP32 Issues to Report:</Text>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>🗑️ Bin overflowing despite sensor reading</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>📡 ESP32 sensor not responding</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>🔧 Bin damaged or broken</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>🚫 Bin blocked or inaccessible</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>🦨 Bad odor or hygiene issues</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>📍 Location or sensor position issues</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>⚡ Power or connectivity issues</Text>
        </View>
        <View style={styles.reportTypeButton}>
          <Text style={styles.reportTypeText}>❓ Other problems</Text>
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Connecting to ESP32 Sensors...</Text>
        <Text style={styles.loadingSubText}>Loading real-time waste management data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Smart Waste Management</Text>
          <Text style={styles.headerSubtitle}>
            ESP32 Public Dashboard {renderConnectionStatus()}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bins' && styles.activeTab]}
          onPress={() => setActiveTab('bins')}
        >
          <Text style={[styles.tabText, activeTab === 'bins' && styles.activeTabText]}>
            📡 Bins
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notices' && styles.activeTab]}
          onPress={() => setActiveTab('notices')}
        >
          <Text style={[styles.tabText, activeTab === 'notices' && styles.activeTabText]}>
            📢 Notices
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            📝 Reports
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'bins' && renderBinsTab()}
      {activeTab === 'notices' && renderNoticesTab()}
      {activeTab === 'reports' && renderReportsTab()}

      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report ESP32 Sensor Issue</Text>
            {selectedBin && (
              <Text style={styles.modalLocationText}>
                Location: {selectedBin.location_name} (ID: {selectedBin.id})
                {selectedBin.sensor_distance && (
                  `\nSensor Distance: ${selectedBin.sensor_distance}cm`
                )}
              </Text>
            )}
            <TextInput
              style={styles.reportInput}
              multiline
              placeholder="Describe the ESP32 sensor or bin issue in detail..."
              value={reportText}
              onChangeText={setReportText}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setReportModalVisible(false);
                  setReportText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitReport}
              >
                <Text style={styles.submitButtonText}>Submit to Admin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    padding: 15,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#C8E6C9',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#1B5E20',
    borderRadius: 5,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 4,
  },
  tab: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingSubText: {
    marginTop: 5,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  esp32StatusCard: {
    backgroundColor: '#E1F5FE',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0288D1',
  },
  esp32StatusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0277BD',
    marginBottom: 8,
  },
  esp32StatusText: {
    fontSize: 12,
    color: '#424242',
    marginBottom: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  autoRefreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  autoRefreshText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastUpdateInfo: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 10,
    borderRadius: 6,
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 8,
    elevation: 2,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
  },
  quickStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  alertSection: {
    backgroundColor: '#FFEBEE',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 10,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  alertLocation: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  alertLevel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  additionalInfoText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  noBinsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noBinsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  enhancedBinCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  binCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  binMainInfo: {
    flex: 1,
  },
  binLocationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  binIdText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  binTypeText: {
    fontSize: 12,
    color: '#888',
  },
  binStatusInfo: {
    alignItems: 'flex-end',
  },
  binStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  binLevelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  fillLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  fillLevelLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
    minWidth: 60,
  },
  fillLevelBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  fillLevelProgress: {
    height: '100%',
    borderRadius: 4,
  },
  fillLevelPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 35,
  },
  binAdditionalInfo: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  recommendationBox: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  recommendationText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500',
  },
  binActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  directionsButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 5,
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  reportButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginLeft: 5,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dataSourceInfo: {
    backgroundColor: '#E8F5E8',
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
  },
  dataSourceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  dataSourceText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  autoRefreshInfo: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  noticeCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 15,
    marginBottom: 10,
    elevation: 2,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  noticeContent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  noticeDate: {
    fontSize: 12,
    color: '#999',
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    marginTop: 20,
    padding: 20,
  },
  reportTypeContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
  },
  reportTypeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  reportTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reportTypeText: {
    fontSize: 14,
    color: '#666',
  },
  infoContainer: {
    backgroundColor: '#e8f5e8',
    margin: 15,
    padding: 15,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    lineHeight: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  modalLocationText: {
    fontSize: 12,
    color: '#2E7D32',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});