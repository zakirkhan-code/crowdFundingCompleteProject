const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  avatar: {
    type: String,
    default: ''
  },
  campaignsCreated: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  }],
  campaignsDonated: [{
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign'
    },
    amount: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  // FIXED: Changed to Number type to prevent increment errors
  totalDonated: {
    type: Number,
    default: 0
  },
  // FIXED: Changed to Number type to prevent increment errors  
  totalRaised: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// FIXED: Add indexes for better query performance
userSchema.index({ address: 1 });
userSchema.index({ email: 1 });

// FIXED: Add pre-save middleware to handle data conversion
userSchema.pre('save', function(next) {
  // Ensure totalDonated and totalRaised are numbers
  if (typeof this.totalDonated === 'string') {
    this.totalDonated = parseFloat(this.totalDonated) || 0;
  }
  if (typeof this.totalRaised === 'string') {
    this.totalRaised = parseFloat(this.totalRaised) || 0;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);