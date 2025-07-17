const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');

// Load environment variables
dotenv.config();

// Import models
const User = require('./models/User');
const Bin = require('./models/Bin');
const Report = require('./models/Report');
const Notice = require('./models/Notice');

const app = express();

// Enhanced CORS configuration for mobile apps
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 200 // Support legacy browsers
}));

// Enhanced middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`📱 ${new Date().toISOString()} - ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Get local IP address function
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// Database connection with better error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/waste_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
  initializeDefaultData();
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  console.log('⚠️  Server will continue without database (demo mode)');
});

// Initialize default data
async function initializeDefaultData() {
  try {
    // Create default admin user
    console.log('Checking for admin user...');
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL || 'admin@dhmc.lk' });
    console.log('Admin exists:', !!adminExists);
    
    if (!adminExists) {
      console.log('Creating admin user...');
      const admin = new User({
        email: process.env.ADMIN_EMAIL || 'admin@dhmc.lk',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        name: process.env.ADMIN_NAME || 'System Admin',
        userType: 'admin'
      });
      await admin.save();
      console.log('✅ Default admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Create sample bins
    const binCount = await Bin.countDocuments();
    if (binCount === 0) {
      const sampleBins = [
        {
          binId: 'DHW001',
          location: {
            latitude: 6.8519,
            longitude: 79.8774,
            address: 'Dehiwala Center'
          },
          level: 85,
          area: 'Dehiwala Center'
        },
        {
          binId: 'DHW002',
          location: {
            latitude: 6.8500,
            longitude: 79.8800,
            address: 'Bus Station'
          },
          level: 45,
          area: 'Bus Station'
        },
        {
          binId: 'DHW003',
          location: {
            latitude: 6.8540,
            longitude: 79.8750,
            address: 'Market Place'
          },
          level: 90,
          area: 'Market Place'
        },
        {
          binId: 'DHW004',
          location: {
            latitude: 6.8560,
            longitude: 79.8720,
            address: 'Sports Ground'
          },
          level: 25,
          area: 'Sports Ground'
        },
        {
          binId: 'DHW005',
          location: {
            latitude: 6.8530,
            longitude: 79.8790,
            address: 'Primary School'
          },
          level: 30,
          area: 'Primary School'
        }
      ];
      
      await Bin.insertMany(sampleBins);
      console.log('✅ Sample bins created');
    }

    // Create sample notices
    const admin = await User.findOne({ userType: 'admin' });
    const noticeCount = await Notice.countDocuments();
    if (noticeCount === 0 && admin) {
      const sampleNotices = [
        {
          title: 'Garbage Collection Schedule',
          content: 'Monday to Wednesday: 6:00 PM collection time',
          createdBy: admin._id,
          priority: 'high'
        },
        {
          title: 'New Bins Installation',
          content: '10 new waste bins have been installed in Dehiwala area',
          createdBy: admin._id,
          priority: 'medium'
        }
      ];
      
      await Notice.insertMany(sampleNotices);
      console.log('✅ Sample notices created');
    }

  } catch (error) {
    console.error('❌ Error initializing default data:', error);
  }
}

// Routes

// Enhanced health check with network info
app.get('/api/health', (req, res) => {
  const localIP = getLocalIPAddress();
  res.json({ 
    status: 'OK', 
    message: 'Waste Management API is running',
    timestamp: new Date().toISOString(),
    server_ip: localIP,
    client_ip: req.ip,
    mongodb_status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Network test endpoint
app.get('/api/network-test', (req, res) => {
  res.json({
    success: true,
    message: 'Network connection successful!',
    server_time: new Date().toISOString(),
    client_ip: req.ip,
    user_agent: req.get('User-Agent')
  });
});

// ========== AUTH ROUTES ==========

// Auth Routes with enhanced error handling
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    console.log('🔐 Login attempt:', { email, userType, ip: req.ip });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // DEMO ADMIN LOGIN - Direct check for demo purposes
    if (email.toLowerCase() === 'admin@dhmc.lk' && password === 'admin123' && userType === 'admin') {
      console.log('✅ Demo admin login successful');
      return res.json({
        success: true,
        user: {
          id: 'demo_admin_id',
          email: 'admin@dhmc.lk',
          name: 'Admin User',
          userType: 'admin'
        },
        message: 'Login successful'
      });
    }

    // DEMO PUBLIC USER LOGIN - Allow any credentials for public users
    if (userType === 'public') {
      console.log('✅ Demo public user login successful');
      return res.json({
        success: true,
        user: {
          id: 'demo_public_id',
          email: email,
          name: 'Public User',
          userType: 'public'
        },
        message: 'Login successful'
      });
    }

    // DATABASE USER LOGIN - Try database authentication
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        console.log('❌ User not found:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.log('❌ Invalid password for user:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check user type if admin login
      if (userType === 'admin' && user.userType !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      console.log('✅ Database login successful:', email);
      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          userType: user.userType
        },
        message: 'Login successful'
      });
    } else {
      // Fallback to demo mode if database is not connected
      console.log('⚠️  Database not connected, using demo mode');
      return res.status(503).json({ 
        error: 'Database temporarily unavailable. Try demo credentials.' 
      });
    }

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Register route (for public users)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    console.log('📝 Registration attempt:', { email, name });

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database temporarily unavailable' 
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      userType: 'public'
    });

    await user.save();

    console.log('✅ User registered successfully:', email);
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType
      },
      message: 'Registration successful'
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ========== BIN ROUTES ==========

// Get all bins
app.get('/api/bins', async (req, res) => {
  try {
    console.log('📍 Fetching bins...');
    
    if (mongoose.connection.readyState !== 1) {
      // Return sample data if database is not connected
      const sampleBins = [
        {
          _id: 'sample1',
          binId: 'DHW001',
          location: { latitude: 6.8519, longitude: 79.8774, address: 'Dehiwala Center' },
          level: 85,
          area: 'Dehiwala Center',
          status: 'active'
        },
        {
          _id: 'sample2',
          binId: 'DHW002',
          location: { latitude: 6.8500, longitude: 79.8800, address: 'Bus Station' },
          level: 45,
          area: 'Bus Station',
          status: 'active'
        }
      ];
      console.log('⚠️  Returning sample data (database offline)');
      return res.json(sampleBins);
    }

    const bins = await Bin.find({ status: 'active' });
    console.log(`✅ Found ${bins.length} bins`);
    res.json(bins);
  } catch (error) {
    console.error('❌ Get bins error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single bin
app.get('/api/bins/:binId', async (req, res) => {
  try {
    const bin = await Bin.findOne({ binId: req.params.binId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }
    res.json(bin);
  } catch (error) {
    console.error('❌ Get bin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ESP32 IoT ROUTES ==========

// ESP32 data endpoint - Update bin level
app.post('/api/bins/:binId/update-level', async (req, res) => {
  try {
    const { level, distance, timestamp } = req.body;
    const { binId } = req.params;

    console.log(`📊 ESP32 Data Received - Bin: ${binId}, Level: ${level}%, Distance: ${distance}cm`);

    if (level === undefined || level < 0 || level > 100) {
      return res.status(400).json({ error: 'Valid level (0-100) is required' });
    }

    if (distance === undefined || distance < 0) {
      return res.status(400).json({ error: 'Valid distance is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  Database offline - storing in memory for demo');
      return res.json({ 
        success: true, 
        message: 'Data received (database offline)',
        data: { binId, level, distance, timestamp } 
      });
    }

    const bin = await Bin.findOneAndUpdate(
      { binId: binId.toUpperCase() },
      { 
        level,
        distance,
        lastUpdated: new Date(),
        sensorData: {
          rawDistance: distance,
          calculatedLevel: level,
          timestamp: timestamp || Date.now()
        }
      },
      { new: true, upsert: true }
    );

    if (!bin) {
      const newBin = new Bin({
        binId: binId.toUpperCase(),
        location: {
          latitude: 6.8519,
          longitude: 79.8774,
          address: `Auto-created bin ${binId}`
        },
        level,
        distance,
        area: 'Auto-detected',
        status: 'active',
        lastUpdated: new Date()
      });

      await newBin.save();
      console.log(`✅ New bin created: ${binId}`);
      return res.json({ 
        success: true, 
        message: `New bin ${binId} created and updated`,
        bin: newBin 
      });
    } else {
      console.log(`✅ Bin ${binId} updated - Level: ${level}%`);
      res.json({ 
        success: true, 
        message: 'Bin level updated successfully',
        bin 
      });
    }

    if (level >= 90) {
      console.log(`🚨 CRITICAL: Bin ${binId} is ${level}% full!`);
    } else if (level >= 80) {
      console.log(`⚠️  WARNING: Bin ${binId} is ${level}% full`);
    }

  } catch (error) {
    console.error('❌ Update bin level error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Real-time bin data
app.get('/api/bins/:binId/realtime', async (req, res) => {
  try {
    const { binId } = req.params;
    
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        binId,
        level: 45,
        distance: 55,
        status: 'demo_mode',
        lastUpdated: new Date().toISOString()
      });
    }

    const bin = await Bin.findOne({ binId: binId.toUpperCase() });
    
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    res.json({
      binId: bin.binId,
      level: bin.level,
      distance: bin.distance,
      location: bin.location,
      area: bin.area,
      status: bin.status,
      lastUpdated: bin.lastUpdated,
      sensorData: bin.sensorData
    });

  } catch (error) {
    console.error('❌ Get realtime data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ESP32 health check
app.get('/api/esp32/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    server: 'Waste Management API',
    endpoints: {
      updateLevel: '/api/bins/{binId}/update-level',
      getConfig: '/api/esp32/config/{binId}',
      getRealtime: '/api/bins/{binId}/realtime'
    }
  });
});

// ========== NOTICE ROUTES ==========

// Get all notices
app.get('/api/notices', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Return sample notices if database is offline
      const sampleNotices = [
        {
          _id: 'sample1',
          title: 'System Notice',
          content: 'Database temporarily unavailable. Some features may be limited.',
          priority: 'high',
          createdAt: new Date(),
          createdBy: { name: 'System' }
        }
      ];
      return res.json(sampleNotices);
    }

    const notices = await Notice.find({ status: 'active' }).populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json(notices);
  } catch (error) {
    console.error('❌ Get notices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notice
app.post('/api/notices', async (req, res) => {
  try {
    console.log('📢 Notice creation request:', req.body);
    const { title, content, priority, adminId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable' });
    }

    // Handle demo admin ID or find real admin
    let createdById = null;
    if (adminId === 'demo_admin_id') {
      // For demo, find any admin user or create without createdBy
      const anyAdmin = await User.findOne({ userType: 'admin' });
      createdById = anyAdmin ? anyAdmin._id : null;
    } else if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      createdById = adminId;
    }

    const notice = new Notice({
      title,
      content,
      priority: priority || 'medium',
      createdBy: createdById
    });

    await notice.save();
    
    if (createdById) {
      await notice.populate('createdBy', 'name');
    }

    console.log('✅ Notice created successfully');
    res.status(201).json({ success: true, notice });
  } catch (error) {
    console.error('❌ Create notice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== REPORT ROUTES ==========

// Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const { status } = req.query;
    
    if (mongoose.connection.readyState !== 1) {
      return res.json([]); // Return empty array if database is offline
    }

    const filter = status ? { status } : {};
    
    const reports = await Report.find(filter)
      .populate('reportedBy', 'name email')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (error) {
    console.error('❌ Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create report
app.post('/api/reports', async (req, res) => {
  try {
    console.log('📋 Report creation request:', req.body);
    const { reportType, description, location, binId, reportedBy } = req.body;

    if (!reportType || !description) {
      return res.status(400).json({ error: 'Report type and description are required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable' });
    }

    // Handle demo user ID
    let reportedById = null;
    if (reportedBy && reportedBy !== 'demo_public_id' && reportedBy !== 'demo_admin_id') {
      if (mongoose.Types.ObjectId.isValid(reportedBy)) {
        reportedById = reportedBy;
      }
    }

    const report = new Report({
      reportType,
      description,
      location,
      binId,
      reportedBy: reportedById
    });

    await report.save();
    
    if (reportedById) {
      await report.populate('reportedBy', 'name email');
    }

    console.log('✅ Report created successfully');
    res.status(201).json({ success: true, report });
  } catch (error) {
    console.error('❌ Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve report
app.patch('/api/reports/:reportId/resolve', async (req, res) => {
  try {
    const { resolvedBy } = req.body;
    const { reportId } = req.params;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database temporarily unavailable' });
    }

    // Handle demo admin ID
    let resolvedById = null;
    if (resolvedBy && resolvedBy !== 'demo_admin_id') {
      if (mongoose.Types.ObjectId.isValid(resolvedBy)) {
        resolvedById = resolvedBy;
      }
    } else if (resolvedBy === 'demo_admin_id') {
      const anyAdmin = await User.findOne({ userType: 'admin' });
      resolvedById = anyAdmin ? anyAdmin._id : null;
    }

    const report = await Report.findByIdAndUpdate(
      reportId,
      {
        status: 'resolved',
        resolvedBy: resolvedById,
        resolvedAt: new Date()
      },
      { new: true }
    ).populate('reportedBy', 'name email').populate('resolvedBy', 'name');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('❌ Resolve report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ANALYTICS ROUTES ==========

// Analytics dashboard
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Return sample analytics if database is offline
      return res.json({
        bins: {
          total: 5,
          full: 2,
          empty: 2,
          averageLevel: 55
        },
        reports: {
          total: 0,
          pending: 0,
          resolved: 0
        },
        note: 'Sample data (database offline)'
      });
    }

    const totalBins = await Bin.countDocuments({ status: 'active' });
    const fullBins = await Bin.countDocuments({ level: { $gte: 80 }, status: 'active' });
    const emptyBins = await Bin.countDocuments({ level: { $lt: 50 }, status: 'active' });
    
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });

    const bins = await Bin.find({ status: 'active' });
    const averageLevel = bins.length > 0 
      ? Math.round(bins.reduce((sum, bin) => sum + bin.level, 0) / bins.length)
      : 0;

    res.json({
      bins: {
        total: totalBins,
        full: fullBins,
        empty: emptyBins,
        averageLevel
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports
      }
    });
  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3002;
const localIP = getLocalIPAddress();

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 ============================================');
  console.log(`   WASTE MANAGEMENT API SERVER STARTED`);
  console.log('============================================');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🏠 Local access: http://localhost:${PORT}/api`);
  console.log(`📱 Mobile access: http://${localIP}:${PORT}/api`);
  console.log(`🗑️ ESP32 Update: POST /api/bins/{binId}/update-level`);
  console.log(`🔍 Health Check: GET /api/health`);
  console.log(`🌐 Network Test: GET /api/network-test`);
  console.log('============================================\n');
  
  // Show all network interfaces
  console.log('📍 Available Network Interfaces:');
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`   ${name}: ${interface.address}`);
      }
    });
  });
  console.log('\n📱 Use the IP address above in your mobile app and ESP32!');
  console.log(`🔧 ESP32 Server URL: http://${localIP}:${PORT}/api/bins/DHW001/update-level\n`);
});

module.exports = app;