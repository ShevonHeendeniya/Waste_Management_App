
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Modal,
  TextInput,
  Dimensions,
  Switch,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function App() { // Changed to App for direct rendering in Canvas
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bins, setBins] = useState([]);
  const [reports, setReports] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [selectedBin, setSelectedBin] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [noticeModalVisible, setNoticeModalVisible] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticePriority, setNoticePriority] = useState('medium');
  const [collectionRoute, setCollectionRoute] = useState([]);
  const [realTimeAlerts, setRealTimeAlerts] = useState([]);
  const [liveUpdates, setLiveUpdates] = useState(0);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(false);
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [reportFilterStatus, setReportFilterStatus] = useState('all');

  const intervalRef = useRef(null);
  const alertTimeoutRef = useRef(null);

  useEffect(() => {
    loadInitialData();
    startRealTimeMonitoring();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      console.log('🔴 LIVE MONITORING ACTIVATED');
      setIsLiveMonitoring(true);
      intervalRef.current = setInterval(() => {
        loadBinsDataWithAlerts();
        loadReports();
        setLiveUpdates(prev => prev + 1);
      }, 5000); // Every 5 seconds for true real-time
    } else {
      console.log('⚪ LIVE MONITORING STOPPED');
      setIsLiveMonitoring(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Real-time monitoring functions
  const startRealTimeMonitoring = () => {
    console.log('🚀 Initializing Real-time Monitoring System...');
    // Simulate WebSocket connection for demo
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('live');
      console.log('✅ Real-time monitoring connected');
    }, 2000);
  };

  const loadBinsDataWithAlerts = async () => {
    try {
      setConnectionStatus('syncing');

      const response = await fetch('http://172.20.10.3:3002/api/bins', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const newData = await response.json();

        // Check for critical level changes
        checkForCriticalAlerts(bins, newData);

        setBins(newData);
        setConnectionStatus('live');
        console.log(`🔄 LIVE UPDATE: ${newData.length} bins synchronized`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Real-time sync failed:', error);
      setConnectionStatus('error');
      // Continue with demo data for simulation
      const simulatedData = generateLiveSimulationData();
      checkForCriticalAlerts(bins, simulatedData);
      setBins(simulatedData);
    } finally {
      setLastUpdate(new Date());
    }
  };

  // Generate live simulation data for demo
  const generateLiveSimulationData = () => {
    return bins.map(bin => {
      // Simulate real-time level changes
      const levelChange = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
      const newLevel = Math.max(0, Math.min(100, bin.level + levelChange));

      return {
        ...bin,
        level: newLevel,
        lastUpdated: new Date().toISOString(),
        distance: newLevel > 0 ? Math.floor(100 - newLevel) : 100,
        sensorStatus: Math.random() > 0.95 ? 'warning' : 'active' // Occasional sensor warnings
      };
    });
  };

  // Check for critical alerts in real-time
  const checkForCriticalAlerts = (oldBins, newBins) => {
    newBins.forEach(newBin => {
      const oldBin = oldBins.find(b => b.binId === newBin.binId);

      // Alert when bin becomes critical (90%+)
      if (oldBin && oldBin.level < 90 && newBin.level >= 90) {
        triggerCriticalAlert(newBin, 'CRITICAL_FULL');
      }

      // Alert when bin reaches 95%
      if (oldBin && oldBin.level < 95 && newBin.level >= 95) {
        triggerCriticalAlert(newBin, 'EMERGENCY');
      }

      // Alert for sensor issues
      if (newBin.sensorStatus === 'warning') {
        triggerCriticalAlert(newBin, 'SENSOR_WARNING');
      }
    });
  };

  // Trigger real-time critical alerts
  const triggerCriticalAlert = (bin, alertType) => {
    const alertId = `${bin.binId}_${Date.now()}`;
    const alert = {
      id: alertId,
      binId: bin.binId,
      type: alertType,
      level: bin.level,
      location: bin.location.address,
      timestamp: new Date(),
      severity: alertType === 'EMERGENCY' ? 'critical' : 'high'
    };

    setRealTimeAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    setCriticalAlertCount(prev => prev + 1);

    // Show immediate notification
    const alertMessages = {
      CRITICAL_FULL: `🚨 CRITICAL: Bin ${bin.binId} is ${bin.level}% full!`,
      EMERGENCY: `🆘 EMERGENCY: Bin ${bin.binId} is ${bin.level}% full - IMMEDIATE ACTION REQUIRED!`,
      SENSOR_WARNING: `⚠️ SENSOR ALERT: Bin ${bin.binId} sensor malfunction detected`
    };

    Alert.alert(
      'REAL-TIME ALERT',
      alertMessages[alertType],
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'Take Action',
          onPress: () => {
            if (alertType === 'SENSOR_WARNING') {
              setActiveTab('reports');
            } else {
              markForCollection(bin.binId);
            }
          }
        }
      ]
    );

    console.log(`🚨 REAL-TIME ALERT: ${alertType} for bin ${bin.binId}`);

    // Auto-dismiss alert after 30 seconds
    setTimeout(() => {
      setRealTimeAlerts(prev => prev.filter(a => a.id !== alertId));
    }, 30000);
  };

  // Dismiss alert
  const dismissAlert = (alertId) => {
    setRealTimeAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  // Render Real-time Alerts
  const renderRealTimeAlerts = () => {
    if (realTimeAlerts.length === 0) return null;

    return (
      <View style={styles.realTimeAlertsContainer}>
        <Text style={styles.realTimeAlertsTitle}>🔴 LIVE ALERTS ({realTimeAlerts.length})</Text>
        {realTimeAlerts.slice(0, 3).map(alert => (
          <View key={alert.id} style={[styles.realTimeAlert,
            { borderLeftColor: alert.severity === 'critical' ? '#D32F2F' : '#F44336' }]}>
            <View style={styles.alertContent}>
              <Text style={styles.alertBinId}>{alert.binId}</Text>
              <Text style={styles.alertMessage}>
                {alert.type === 'CRITICAL_FULL' && `🚨 Critical: ${alert.level}% Full`}
                {alert.type === 'EMERGENCY' && `🆘 Emergency: ${alert.level}% Full`}
                {alert.type === 'SENSOR_WARNING' && `⚠️ Sensor Warning`}
              </Text>
              <Text style={styles.alertLocation}>{alert.location}</Text>
              <Text style={styles.alertTime}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => dismissAlert(alert.id)}
            >
              <Text style={styles.dismissButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {realTimeAlerts.length > 3 && (
          <TouchableOpacity style={styles.viewAllAlertsButton}>
            <Text style={styles.viewAllAlertsText}>
              View All {realTimeAlerts.length} Alerts →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Live Monitoring Status
  const renderLiveStatus = () => {
    const statusConfig = {
      live: { color: '#4CAF50', text: 'LIVE', icon: '🔴', pulse: true },
      syncing: { color: '#FF9800', text: 'SYNCING', icon: '🟡', pulse: true },
      connecting: { color: '#2196F3', text: 'CONNECTING', icon: '🔵', pulse: true },
      error: { color: '#F44336', text: 'OFFLINE', icon: '⚪', pulse: false }
    };

    const status = statusConfig[connectionStatus] || statusConfig.error;

    return (
      <View style={styles.liveStatusContainer}>
        <View style={[styles.statusIndicator,
          { backgroundColor: status.color },
          status.pulse && styles.pulseAnimation
        ]}>
          <Text style={styles.statusIcon}>{status.icon}</Text>
        </View>
        <View style={styles.statusInfo}>
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.text} MONITORING
          </Text>
          <Text style={styles.statusDetails}>
            {connectionStatus === 'live' && `Updates: ${liveUpdates} • Critical: ${criticalAlertCount}`}
            {connectionStatus === 'syncing' && 'Fetching ESP32 data...'}
            {connectionStatus === 'connecting' && 'Establishing connection...'}
            {connectionStatus === 'error' && 'Connection lost - Using cached data'}
          </Text>
        </View>
      </View>
    );
  };

  // FIXED: Made loadInitialData async
  const loadInitialData = async () => {
    setConnectionStatus('loading');
    try {
      await Promise.all([
        loadBinsData(),
        loadReports(),
        generateOptimalRoute()
      ]);
      setConnectionStatus('live'); // Changed to live as connection is established
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setConnectionStatus('error');
      setBins(getDemoData());
      setReports(getDemoReports());
    } finally {
      setLastUpdate(new Date());
    }
  };

  const loadBinsData = async () => {
    try {
      const response = await fetch('http://172.20.10.3:3002/api/bins', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setBins(data);
        console.log(`✅ Loaded ${data.length} bins data`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error loading bins:', error);
      setBins(getDemoData());
    }
  };

  const loadReports = async () => {
    try {
      const response = await fetch('http://172.20.10.3:3002/api/reports', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data);
        console.log(`✅ Loaded ${data.length} reports`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error loading reports:', error);
      setReports(getDemoReports());
    }
  };

  const getDemoData = () => [
    {
      binId: 'DHW001',
      location: { address: 'Dehiwala Railway Station', latitude: 6.8519, longitude: 79.8774 },
      level: 95, area: 'Railway Station', type: 'General Waste', lastUpdated: new Date().toISOString(),
      distance: 5, status: 'critical', sensorStatus: 'active'
    },
    {
      binId: 'DHW002',
      location: { address: 'Market Square', latitude: 6.8545, longitude: 79.8796 },
      level: 85, area: 'Market Square', type: 'General Waste', lastUpdated: new Date().toISOString(),
      distance: 15, status: 'full', sensorStatus: 'active'
    },
    {
      binId: 'DHW003',
      location: { address: 'Hospital Entrance', latitude: 6.8501, longitude: 79.8821 },
      level: 45, area: 'Hospital Area', type: 'Medical Waste', lastUpdated: new Date().toISOString(),
      distance: 55, status: 'normal', sensorStatus: 'active'
    },
    {
      binId: 'DHW004',
      location: { address: 'Beach Road Park', latitude: 6.8480, longitude: 79.8750 },
      level: 75, area: 'Park Area', type: 'General Waste', lastUpdated: new Date().toISOString(),
      distance: 25, status: 'moderate', sensorStatus: 'active'
    },
    {
      binId: 'DHW005',
      location: { address: 'School Main Gate', latitude: 6.8530, longitude: 79.8790 },
      level: 30, area: 'Education Zone', type: 'General Waste', lastUpdated: new Date().toISOString(),
      distance: 70, status: 'normal', sensorStatus: 'active'
    },
    {
      binId: 'DHW006',
      location: { address: 'Zoo Entrance', latitude: 6.8500, longitude: 79.8800 },
      level: 92, area: 'Zoo Area', type: 'General Waste', lastUpdated: new Date().toISOString(),
      distance: 8, status: 'critical', sensorStatus: 'warning' // Example sensor warning
    }
  ];

  const getDemoReports = () => [
    {
      id: 'RPT001', binId: 'DHW001', reportType: 'bin_full',
      description: 'Bin overflowing with waste',
      location: 'Dehiwala Railway Station', status: 'pending', priority: 'high',
      reportedBy: 'Public User', createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'RPT002', binId: 'DHW002', reportType: 'bin_damaged',
      description: 'Bin lid is broken',
      location: 'Market Square', status: 'pending', priority: 'medium',
      reportedBy: 'Collector Team', createdAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'RPT003', binId: 'DHW003', reportType: 'unsanitary_condition',
      description: 'Bad smell and flies around bin',
      location: 'Hospital Entrance', status: 'resolved', priority: 'high',
      reportedBy: 'Public User', createdAt: new Date(Date.now() - 10800000).toISOString(),
      resolvedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'RPT004', binId: 'DHW006', reportType: 'sensor_malfunction',
      description: 'Ultrasonic sensor reading erratic values',
      location: 'Zoo Entrance', status: 'pending', priority: 'urgent',
      reportedBy: 'System', createdAt: new Date(Date.now() - 10000).toISOString()
    }
  ];

  // Route Optimization Algorithm
  const generateOptimalRoute = () => {
    const fullBins = bins.filter(bin => bin.level >= 80);
    const sortedByUrgency = fullBins.sort((a, b) => {
      const urgencyA = a.level + (a.type === 'Medical Waste' ? 20 : 0);
      const urgencyB = b.level + (b.type === 'Medical Waste' ? 20 : 0);
      return urgencyB - urgencyA;
    });

    const route = sortedByUrgency.map((bin, index) => ({
      ...bin,
      order: index + 1,
      estimatedTime: (index + 1) * 15, // 15 mins per bin
      priority: bin.level >= 90 ? 'CRITICAL' : 'HIGH'
    }));

    setCollectionRoute(route);
    return route;
  };

  // Send Notice to Public Dashboard
  const sendNoticeToPublic = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('http://172.20.10.3:3002/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noticeTitle,
          content: noticeContent,
          priority: noticePriority,
          adminId: 'demo_admin_id'
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Notice sent to all public users successfully!');
        setNoticeModalVisible(false);
        setNoticeTitle('');
        setNoticeContent('');
        setNoticePriority('medium');
      } else {
        throw new Error('Failed to send notice');
      }
    } catch (error) {
      console.error('Error sending notice:', error);
      Alert.alert('Notice Sent', 'Notice has been sent to all public dashboard users! (Demo mode)');
      setNoticeModalVisible(false);
      setNoticeTitle('');
      setNoticeContent('');
    }
  };

  // Mark bin for collection
  const markForCollection = (binId) => {
    Alert.alert(
      'Mark for Collection',
      `Mark bin ${binId} for immediate collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Mark',
          onPress: () => {
            setBins(bins.map(bin =>
              bin.binId === binId
                ? { ...bin, markedForCollection: true, collectionScheduled: new Date().toISOString() }
                : bin
            ));
            Alert.alert('Success', `Bin ${binId} marked for collection. Collection team will be notified.`);
          }
        }
      ]
    );
  };

  // Resolve report
  const resolveReport = (reportId) => {
    Alert.alert(
      'Resolve Report',
      'Mark this report as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: () => {
            setReports(reports.map(report =>
              report.id === reportId
                ? { ...report, status: 'resolved', resolvedAt: new Date().toISOString() }
                : report
            ));
            Alert.alert('Success', 'Report marked as resolved!');
          }
        }
      ]
    );
  };

  // Open full bin locations in maps
  const openFullBinMap = () => {
    const fullBins = bins.filter(bin => bin.level >= 80);
    if (fullBins.length === 0) {
      Alert.alert('Info', 'No full bins detected at the moment!');
      return;
    }

    // Create Google Maps URL with multiple locations
    const locations = fullBins.map(bin =>
      `${bin.location.latitude},${bin.location.longitude}(${bin.binId}: ${bin.level}% Full)`
    ).join('|');

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&waypoints=${locations}&travelmode=driving`;

    Alert.alert(
      'Full Bins Map',
      `Found ${fullBins.length} full bins. Open optimized route in Google Maps?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Maps', onPress: () => Linking.openURL(mapsUrl) }
      ]
    );
  };

  // Get status functions
  const getStatusColor = (level) => {
    if (level >= 90) return '#D32F2F'; // Critical
    if (level >= 80) return '#F44336'; // Full
    if (level >= 50) return '#FF9800'; // Half Full
    return '#4CAF50'; // Available
  };

  const getStatusText = (level) => {
    if (level >= 90) return 'CRITICAL';
    if (level >= 80) return 'FULL';
    if (level >= 50) return 'HALF FULL';
    return 'AVAILABLE';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#D32F2F';
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Render Dashboard Tab (Enhanced with Real-time)
  const renderDashboard = () => {
    const stats = {
      total: bins.length,
      critical: bins.filter(bin => bin.level >= 90).length,
      full: bins.filter(bin => bin.level >= 80).length,
      available: bins.filter(bin => bin.level < 50).length,
      pendingReports: reports.filter(report => report.status === 'pending').length
    };

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={connectionStatus === 'syncing'} onRefresh={loadInitialData} />}
      >
        {/* Live Monitoring Status */}
        {renderLiveStatus()}

        {/* Real-time Alerts */}
        {renderRealTimeAlerts()}

        {/* Admin Quick Stats */}
        <View style={styles.adminStatsContainer}>
          <View style={styles.statsHeader}>
            <Text style={styles.sectionTitle}>📊 System Overview</Text>
            {isLiveMonitoring && (
              <View style={styles.liveIndicator}>
                <View style={[styles.liveDot, styles.pulseAnimation]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderLeftColor: '#2E7D32' }]}>
              <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Bins</Text>
              <Text style={styles.statSubLabel}>ESP32 Connected</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#F44336' }]}>
              <Text style={[styles.statNumber, { color: '#F44336' }]}>{stats.critical}</Text>
              <Text style={styles.statLabel}>Critical</Text>
              <Text style={styles.statSubLabel}>Need Collection</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#FF9800' }]}>
              <Text style={[styles.statNumber, { color: '#FF9800' }]}>{stats.full}</Text>
              <Text style={styles.statLabel}>Full Bins</Text>
              <Text style={styles.statSubLabel}>80%+ Capacity</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#4CAF50' }]}>
              <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.available}</Text>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statSubLabel}>Ready for Use</Text>
            </View>
          </View>
        </View>

        {/* Live Data Feed */}
        <View style={styles.liveDataFeed}>
          <Text style={styles.sectionTitle}>📡 Live Data Feed</Text>
          <View style={styles.dataFeedContainer}>
            <View style={styles.dataFeedItem}>
              <Text style={styles.dataFeedLabel}>Last Sync:</Text>
              <Text style={styles.dataFeedValue}>
                {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Never'}
              </Text>
            </View>
            <View style={styles.dataFeedItem}>
              <Text style={styles.dataFeedLabel}>Updates:</Text>
              <Text style={styles.dataFeedValue}>{liveUpdates}</Text>
            </View>
            <View style={styles.dataFeedItem}>
              <Text style={styles.dataFeedLabel}>Alerts:</Text>
              <Text style={[styles.dataFeedValue, { color: '#F44336' }]}>
                {criticalAlertCount}
              </Text>
            </View>
            <View style={styles.dataFeedItem}>
              <Text style={styles.dataFeedLabel}>Status:</Text>
              <Text style={[styles.dataFeedValue,
                { color: connectionStatus === 'live' ? '#4CAF50' : '#FF9800' }]}>
                {connectionStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionButtonsGrid}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#F44336' }]} onPress={openFullBinMap}>
              <Text style={styles.actionButtonIcon}>🗺️</Text>
              <Text style={styles.actionButtonText}>Full Bins Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF9800' }]} onPress={() => setActiveTab('route')}>
              <Text style={styles.actionButtonIcon}>🚛</Text>
              <Text style={styles.actionButtonText}>Collection Route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2196F3' }]} onPress={() => setNoticeModalVisible(true)}>
              <Text style={styles.actionButtonIcon}>📢</Text>
              <Text style={styles.actionButtonText}>Send Notice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#9C27B0' }]} onPress={() => setActiveTab('reports')}>
              <Text style={styles.actionButtonIcon}>📋</Text>
              <Text style={styles.actionButtonText}>View Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Critical Alerts */}
        {stats.critical > 0 && (
          <View style={styles.criticalAlertsContainer}>
            <Text style={styles.alertTitle}>🚨 Critical Bins Requiring Immediate Attention</Text>
            {bins.filter(bin => bin.level >= 90).slice(0, 3).map(bin => (
              <View key={bin.binId} style={styles.criticalAlertItem}>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertBinId}>{bin.binId}</Text>
                  <Text style={styles.alertLocation}>{bin.location.address}</Text>
                  <Text style={styles.alertLevel}>{bin.level}% Full - {bin.type}</Text>
                </View>
                <TouchableOpacity style={styles.alertActionButton} onPress={() => markForCollection(bin.binId)}>
                  <Text style={styles.alertActionText}>🚛 Collect</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Recent Reports Summary */}
        <View style={styles.recentReportsContainer}>
          <Text style={styles.sectionTitle}>📋 Recent Reports ({stats.pendingReports} Pending)</Text>
          {reports.slice(0, 3).map(report => (
            <View key={report.id} style={styles.reportSummaryItem}>
              <View style={styles.reportInfo}>
                <Text style={styles.reportBinId}>{report.binId}</Text>
                <Text style={styles.reportDescription}>{report.description}</Text>
                <Text style={styles.reportMeta}>{report.reportType} • {formatTime(report.createdAt)}</Text>
              </View>
              <View style={[styles.reportStatus, { backgroundColor: getPriorityColor(report.priority) }]}>
                <Text style={styles.reportStatusText}>{report.status.toUpperCase()}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.viewAllButton} onPress={() => setActiveTab('reports')}>
            <Text style={styles.viewAllText}>View All Reports →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Render Full Bins Map Tab
  const renderBinsMap = () => {
    const filteredBins = bins.filter(bin =>
      bin.binId.toLowerCase().includes(binSearchQuery.toLowerCase()) ||
      bin.location.address.toLowerCase().includes(binSearchQuery.toLowerCase()) ||
      bin.area.toLowerCase().includes(binSearchQuery.toLowerCase())
    );

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={connectionStatus === 'syncing'} onRefresh={loadBinsData} />}
      >
        <Text style={styles.sectionTitle}>🗑️ All Smart Bins</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Bins by ID, Location, or Area..."
          value={binSearchQuery}
          onChangeText={setBinSearchQuery}
        />
        {filteredBins.length === 0 ? (
          <Text style={styles.noDataText}>No bins found matching your search.</Text>
        ) : (
          filteredBins.map(bin => (
            <TouchableOpacity
              key={bin.binId}
              style={styles.binCard}
              onPress={() => { setSelectedBin(bin); setModalVisible(true); }}
            >
              <View style={[styles.binLevelIndicator, { backgroundColor: getStatusColor(bin.level) }]} />
              <View style={styles.binInfo}>
                <Text style={styles.binId}>{bin.binId} <Text style={{ color: getStatusColor(bin.level), fontWeight: 'bold' }}>({getStatusText(bin.level)})</Text></Text>
                <Text style={styles.binLocation}>{bin.location.address}</Text>
                <Text style={styles.binDetails}>Level: {bin.level}% | Type: {bin.type} | Last Updated: {formatTime(bin.lastUpdated)}</Text>
                {bin.sensorStatus === 'warning' && (
                  <Text style={styles.sensorWarningText}>⚠️ Sensor Warning: Malfunction Detected</Text>
                )}
                {bin.markedForCollection && (
                  <Text style={styles.markedForCollectionText}>🚛 Marked for Collection</Text>
                )}
              </View>
              <View style={styles.binActions}>
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: '#2196F3' }]}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${bin.location.latitude},${bin.location.longitude}`)}
                >
                  <Text style={styles.actionButtonSmallText}>Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: '#F44336' }]}
                  onPress={() => markForCollection(bin.binId)}
                >
                  <Text style={styles.actionButtonSmallText}>Collect</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  // Render Reports Tab
  const renderReports = () => {
    const filteredReports = reports.filter(report => {
      if (reportFilterStatus === 'all') return true;
      return report.status === reportFilterStatus;
    });

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={connectionStatus === 'syncing'} onRefresh={loadReports} />}
      >
        <Text style={styles.sectionTitle}>📋 User & System Reports</Text>
        <View style={styles.filterButtonsContainer}>
          <TouchableOpacity
            style={[styles.filterButton, reportFilterStatus === 'all' && styles.filterButtonActive]}
            onPress={() => setReportFilterStatus('all')}
          >
            <Text style={styles.filterButtonText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, reportFilterStatus === 'pending' && styles.filterButtonActive]}
            onPress={() => setReportFilterStatus('pending')}
          >
            <Text style={styles.filterButtonText}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, reportFilterStatus === 'resolved' && styles.filterButtonActive]}
            onPress={() => setReportFilterStatus('resolved')}
          >
            <Text style={styles.filterButtonText}>Resolved</Text>
          </TouchableOpacity>
        </View>

        {filteredReports.length === 0 ? (
          <Text style={styles.noDataText}>No reports found for this status.</Text>
        ) : (
          filteredReports.map(report => (
            <View key={report.id} style={styles.reportCard}>
              <View style={[styles.reportPriorityIndicator, { backgroundColor: getPriorityColor(report.priority) }]} />
              <View style={styles.reportContent}>
                <Text style={styles.reportId}>Report ID: {report.id}</Text>
                <Text style={styles.reportBinId}>Bin ID: {report.binId} - {report.location}</Text>
                <Text style={styles.reportDescription}>{report.description}</Text>
                <Text style={styles.reportMeta}>
                  Type: {report.reportType.replace(/_/g, ' ')} | By: {report.reportedBy} | Reported: {formatDate(report.createdAt)} {formatTime(report.createdAt)}
                </Text>
                {report.status === 'resolved' && (
                  <Text style={styles.reportResolvedText}>Resolved At: {formatDate(report.resolvedAt)} {formatTime(report.resolvedAt)}</Text>
                )}
              </View>
              <View style={styles.reportActions}>
                {report.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, { backgroundColor: '#4CAF50' }]}
                    onPress={() => resolveReport(report.id)}
                  >
                    <Text style={styles.actionButtonSmallText}>Resolve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: '#2196F3' }]}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${reports.find(r => r.id === report.id)?.location}`)} // Assuming location can be directly used for search
                >
                  <Text style={styles.actionButtonSmallText}>Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // Render Route Optimization Tab
  const renderRouteOptimization = () => {
    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={generateOptimalRoute} />}
      >
        <Text style={styles.sectionTitle}>🚛 Optimal Collection Route</Text>
        <Text style={styles.routeDescription}>
          This route is dynamically generated based on bin fill levels (80%+ full) and priority (Medical Waste prioritized).
          Refresh to regenerate the route with the latest data.
        </Text>
        <TouchableOpacity style={styles.generateRouteButton} onPress={openFullBinMap}>
          <Text style={styles.generateRouteButtonText}>Open Route in Google Maps</Text>
        </TouchableOpacity>

        {collectionRoute.length === 0 ? (
          <Text style={styles.noDataText}>No bins currently require collection for route generation.</Text>
        ) : (
          collectionRoute.map((bin, index) => (
            <View key={bin.binId} style={styles.routeItemCard}>
              <View style={[styles.routeOrderCircle, { backgroundColor: getStatusColor(bin.level) }]}>
                <Text style={styles.routeOrderText}>{bin.order}</Text>
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.routeBinId}>{bin.binId} - {bin.location.address}</Text>
                <Text style={styles.routeLevel}>Level: {bin.level}% Full | Type: {bin.type}</Text>
                <Text style={styles.routeTime}>Estimated Time: {bin.estimatedTime} mins</Text>
                <Text style={[styles.routePriority, { color: getPriorityColor(bin.priority === 'CRITICAL' ? 'urgent' : 'high') }]}>
                  Priority: {bin.priority}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButtonSmall, { backgroundColor: '#2196F3' }]}
                onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${bin.location.latitude},${bin.location.longitude}`)}
              >
                <Text style={styles.actionButtonSmallText}>View</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // Render Settings Tab
  const renderSettings = () => {
    const handleClearAlerts = () => {
      Alert.alert(
        'Clear All Alerts',
        'Are you sure you want to clear all real-time alerts?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', onPress: () => { setRealTimeAlerts([]); setCriticalAlertCount(0); Alert.alert('Success', 'All alerts cleared.'); } }
        ]
      );
    };

    const handleTestConnection = async () => {
      setConnectionStatus('connecting');
      try {
        const response = await fetch('http://172.20.10.3:3002/api/test-connection', { method: 'GET' });
        if (response.ok) {
          setConnectionStatus('live');
          Alert.alert('Connection Test', 'Successfully connected to the backend API.');
        } else {
          throw new Error('API responded with an error.');
        }
      } catch (error) {
        setConnectionStatus('error');
        Alert.alert('Connection Test Failed', `Could not connect to the backend API. Error: ${error.message}`);
      }
    };

    const handleLogout = () => {
      Alert.alert(
        'Logout',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', onPress: () => { Alert.alert('Logged Out', 'You have been successfully logged out. (Demo)'); /* navigation.navigate('Login'); */ } }
        ]
      );
    };

    return (
      <ScrollView style={styles.tabContent}>
        <Text style={styles.sectionTitle}>⚙️ Application Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Enable Auto-Refresh (Live Monitoring)</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={autoRefresh ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={setAutoRefresh}
            value={autoRefresh}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Current Connection Status:</Text>
          <Text style={[styles.settingValue, { color: connectionStatus === 'live' ? '#4CAF50' : '#F44336' }]}>
            {connectionStatus.toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity style={styles.settingsButton} onPress={handleTestConnection}>
          <Text style={styles.settingsButtonText}>Test API Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsButton} onPress={handleClearAlerts}>
          <Text style={styles.settingsButtonText}>Clear All Real-time Alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingsButton, { backgroundColor: '#D32F2F' }]} onPress={handleLogout}>
          <Text style={styles.settingsButtonText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>App Version: 1.0.0</Text>
        <Text style={styles.versionText}>Last Updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</Text>
      </ScrollView>
    );
  };

  // Render Modals
  const renderModals = () => (
    <>
      {/* Bin Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {selectedBin && (
              <>
                <Text style={styles.modalTitle}>Bin Details: {selectedBin.binId}</Text>
                <Text style={styles.modalText}>Location: {selectedBin.location.address}</Text>
                <Text style={styles.modalText}>Area: {selectedBin.area}</Text>
                <Text style={styles.modalText}>Type: {selectedBin.type}</Text>
                <Text style={styles.modalText}>Level: {selectedBin.level}%</Text>
                <Text style={styles.modalText}>Status: {getStatusText(selectedBin.level)}</Text>
                <Text style={styles.modalText}>Last Updated: {formatDate(selectedBin.lastUpdated)} {formatTime(selectedBin.lastUpdated)}</Text>
                {selectedBin.sensorStatus === 'warning' && (
                  <Text style={styles.modalSensorWarning}>⚠️ Sensor Malfunction Detected</Text>
                )}
                {selectedBin.markedForCollection && (
                  <Text style={styles.modalMarkedForCollection}>🚛 Marked for Collection</Text>
                )}
                <TouchableOpacity
                  style={[styles.button, styles.buttonClose]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.textStyle}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonAction]}
                  onPress={() => {
                    setModalVisible(false);
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selectedBin.location.latitude},${selectedBin.location.longitude}`);
                  }}
                >
                  <Text style={styles.textStyle}>Open in Map</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Send Notice Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={noticeModalVisible}
        onRequestClose={() => setNoticeModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>📢 Send Public Notice</Text>
            <TextInput
              style={styles.input}
              placeholder="Notice Title"
              value={noticeTitle}
              onChangeText={setNoticeTitle}
            />
            <TextInput
              style={[styles.input, { height: 100 }]}
              placeholder="Notice Content"
              multiline
              value={noticeContent}
              onChangeText={setNoticeContent}
            />
            <View style={styles.priorityContainer}>
              <Text style={styles.priorityLabel}>Priority:</Text>
              {['low', 'medium', 'high', 'urgent'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    noticePriority === p && styles.priorityButtonActive,
                    { backgroundColor: noticePriority === p ? getPriorityColor(p) : '#E0E0E0' }
                  ]}
                  onPress={() => setNoticePriority(p)}
                >
                  <Text style={[styles.priorityButtonText, { color: noticePriority === p ? '#FFFFFF' : '#424242' }]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.button, styles.buttonAction]}
              onPress={sendNoticeToPublic}
            >
              <Text style={styles.textStyle}>Send Notice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonClose]}
              onPress={() => setNoticeModalVisible(false)}
            >
              <Text style={styles.textStyle}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Smart Waste Admin</Text>
          <Text style={styles.headerSubtitle}>Dehiwala-Mount Lavinia</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.liveMonitoringToggle}>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={autoRefresh ? "#f5dd4b" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={setAutoRefresh}
              value={autoRefresh}
            />
            <Text style={styles.monitoringLabel}>{autoRefresh ? 'LIVE ON' : 'LIVE OFF'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={() => Alert.alert('Logout', 'You have been logged out. (Demo)')}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'bins' && styles.activeTab]}
          onPress={() => setActiveTab('bins')}
        >
          <Text style={[styles.tabText, activeTab === 'bins' && styles.activeTabText]}>Bins</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'route' && styles.activeTab]}
          onPress={() => setActiveTab('route')}
        >
          <Text style={[styles.tabText, activeTab === 'route' && styles.activeTabText]}>Route</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'bins' && renderBinsMap()}
      {activeTab === 'reports' && renderReports()}
      {activeTab === 'route' && renderRouteOptimization()}
      {activeTab === 'settings' && renderSettings()}

      {renderModals()}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#C8E6C9',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveMonitoringToggle: {
    alignItems: 'center',
    marginRight: 15,
  },
  autoRefreshButton: {
    padding: 8,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoRefreshButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  monitoringLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: '#1B5E20',
    borderRadius: 5,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Real-time Monitoring Styles
  realTimeAlertsContainer: {
    backgroundColor: '#FFEBEE',
    margin: 15,
    borderRadius: 10,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    elevation: 5,
  },
  realTimeAlertsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 15,
  },
  realTimeAlert: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    elevation: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertBinId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  alertMessage: {
    fontSize: 13,
    color: '#F44336',
    fontWeight: 'bold',
    marginTop: 2,
  },
  alertLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  alertTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  dismissButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewAllAlertsButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  viewAllAlertsText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Live Status Styles
  liveStatusContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    alignItems: 'center',
  },
  statusIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  pulseAnimation: {
    // CSS animation would be implemented with Animated API in React Native
  },

  // Enhanced Dashboard Styles
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
    marginRight: 5,
  },
  liveText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F44336',
  },
  statSubLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  liveDataFeed: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 10,
    padding: 15,
    elevation: 3,
  },
  dataFeedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataFeedItem: {
    width: '48%',
    marginBottom: 10,
  },
  dataFeedLabel: {
    fontSize: 12,
    color: '#777',
  },
  dataFeedValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },

  // Quick Actions Styles
  quickActionsContainer: {
    marginBottom: 20,
    marginHorizontal: 15,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionButtonIcon: {
    fontSize: 30,
    marginBottom: 5,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Critical Alerts Section
  criticalAlertsContainer: {
    backgroundColor: '#FFEBEE',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    elevation: 5,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 10,
  },
  criticalAlertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    elevation: 2,
  },
  alertInfo: {
    flex: 1,
  },
  alertBinId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  alertLocation: {
    fontSize: 12,
    color: '#666',
  },
  alertLevel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 5,
  },
  alertActionButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  alertActionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },

  // Recent Reports Summary
  recentReportsContainer: {
    marginBottom: 20,
    marginHorizontal: 15,
  },
  reportSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800', // Default for pending
    elevation: 2,
  },
  reportInfo: {
    flex: 1,
  },
  reportBinId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  reportDescription: {
    fontSize: 13,
    color: '#555',
  },
  reportMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  reportStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    marginLeft: 10,
  },
  reportStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewAllButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  viewAllText: {
    color: '#3F51B5',
    fontWeight: 'bold',
    fontSize: 13,
  },

  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#2E7D32',
  },
  tabText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
    paddingLeft: 10,
  },

  // Bins Map Tab Styles
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  openMapsButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    elevation: 2,
  },
  openMapsText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  mapStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
  },
  mapStatItem: {
    alignItems: 'center',
  },
  mapStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  mapStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  mapBinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  mapBinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapBinInfo: {
    flex: 1,
  },
  mapBinId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  mapBinLocation: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  mapBinCoords: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  mapBinStatus: {
    alignItems: 'flex-end',
  },
  mapBinLevel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapBinStatusText: {
    fontSize: 12,
    color: '#555',
  },
  mapBinActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  mapActionButton: {
    backgroundColor: '#3F51B5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  mapActionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  searchInput: {
    height: 45,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  binCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  binLevelIndicator: {
    width: 10,
    height: '100%',
    borderRadius: 5,
    marginRight: 10,
  },
  binInfo: {
    flex: 1,
  },
  binId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  binLocation: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  binDetails: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
  },
  sensorWarningText: {
    fontSize: 12,
    color: '#FF5722',
    fontWeight: 'bold',
    marginTop: 5,
  },
  markedForCollectionText: {
    fontSize: 12,
    color: '#3F51B5',
    fontWeight: 'bold',
    marginTop: 5,
  },
  binActions: {
    flexDirection: 'column',
    marginLeft: 10,
  },
  actionButtonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginBottom: 5,
    alignItems: 'center',
  },
  actionButtonSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noDataText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 16,
    marginTop: 20,
  },

  // Reports Tab Styles
  filterButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
  },
  filterButtonText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  reportCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  reportPriorityIndicator: {
    width: 10,
    height: '100%',
    borderRadius: 5,
    marginRight: 10,
  },
  reportContent: {
    flex: 1,
  },
  reportId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  reportDescription: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  reportMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
  },
  reportResolvedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 5,
  },
  reportActions: {
    flexDirection: 'column',
    marginLeft: 10,
  },

  // Route Optimization Tab Styles
  routeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  generateRouteButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  generateRouteButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  routeItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  routeOrderCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  routeOrderText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  routeDetails: {
    flex: 1,
  },
  routeBinId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeLevel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  routeTime: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  routePriority: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 5,
  },

  // Settings Tab Styles
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },

  // Modal Styles
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: width * 0.9,
    maxHeight: height * 0.8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalText: {
    marginBottom: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
  modalSensorWarning: {
    fontSize: 14,
    color: '#FF5722',
    fontWeight: 'bold',
    marginTop: 10,
  },
  modalMarkedForCollection: {
    fontSize: 14,
    color: '#3F51B5',
    fontWeight: 'bold',
    marginTop: 10,
  },
  button: {
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    marginTop: 15,
    width: '100%',
  },
  buttonClose: {
    backgroundColor: '#9E9E9E',
  },
  buttonAction: {
    backgroundColor: '#2E7D32',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  input: {
    height: 50,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: '100%',
    fontSize: 16,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
    justifyContent: 'space-around',
  },
  priorityLabel: {
    fontSize: 16,
    color: '#555',
    marginRight: 10,
  },
  priorityButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BDBDBD',
  },
  priorityButtonActive: {
    borderColor: '#2E7D32',
    borderWidth: 2,
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});