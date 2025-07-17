const mongoose = require('mongoose');

const binSchema = new mongoose.Schema({
  binId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  location: {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      required: true,
      trim: true
    }
  },
  level: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  distance: {
    type: Number,
    min: 0,
    default: null
  },
  area: {
    type: String,
    required: true,
    trim: true
  },
  capacity: {
    type: Number,
    default: 240, // Default 240L capacity
    min: 50
  },
  type: {
    type: String,
    enum: ['General Waste', 'Recyclable', 'Medical Waste', 'Organic'],
    default: 'General Waste'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  lastCollected: {
    type: Date,
    default: null
  },
  sensorData: {
    rawDistance: Number,
    calculatedLevel: Number,
    timestamp: Number,
    batteryLevel: Number,
    signalStrength: Number
  },
  collectionSchedule: {
    type: String,
    default: 'Daily 6:00 AM'
  }
}, {
  timestamps: true
});

// Index for geospatial queries
binSchema.index({ "location.latitude": 1, "location.longitude": 1 });

// Index for status and level queries
binSchema.index({ status: 1, level: -1 });

module.exports = mongoose.model('Bin', binSchema);