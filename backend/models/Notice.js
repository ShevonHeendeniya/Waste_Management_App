const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  type: {
    type: String,
    enum: ['announcement', 'schedule', 'alert', 'maintenance', 'general'],
    default: 'general'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },
  expiryDate: {
    type: Date,
    default: null
  },
  targetAudience: {
    type: String,
    enum: ['all', 'public', 'collectors', 'admins'],
    default: 'all'
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number
  }]
}, {
  timestamps: true
});

// Static method to get active notices
noticeSchema.statics.getActiveNotices = function() {
  return this.find({
    status: 'active',
    $or: [
      { expiryDate: null },
      { expiryDate: { $gt: new Date() } }
    ]
  }).sort({ priority: 1, createdAt: -1 });
};

// Index for status and priority queries
noticeSchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model('Notice', noticeSchema);