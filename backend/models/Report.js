const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    required: true,
    enum: [
      'bin_full',
      'bin_damaged',
      'unsanitary_condition',
      'missing_bin',
      'collection_missed',
      'illegal_dumping',
      'other'
    ]
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  binId: {
    type: String,
    trim: true,
    uppercase: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolutionNotes: {
    type: String,
    trim: true
  },
  images: [{
    url: String,
    caption: String
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index for status and priority queries
reportSchema.index({ status: 1, priority: -1, createdAt: -1 });

// Index for location-based queries
reportSchema.index({ "location.latitude": 1, "location.longitude": 1 });

module.exports = mongoose.model('Report', reportSchema);