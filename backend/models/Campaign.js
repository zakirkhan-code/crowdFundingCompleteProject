const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  contractId: {
    type: Number,
    required: true,
    unique: true
  },
  owner: {
    type: String,
    required: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  target: {
    type: String,
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  amountCollected: {
    type: String,
    default: '0'
  },
  image: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['education', 'health', 'environment', 'technology', 'community', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  donators: [{
    address: String,
    amount: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  totalDonations: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
campaignSchema.index({ owner: 1 });
campaignSchema.index({ category: 1 });
campaignSchema.index({ deadline: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);