const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./config/database');
const { errorHandler } = require('./middleware/auth');

// Import routes
const campaignRoutes = require('./routes/campaigns');
const userRoutes = require('./routes/users');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/users', userRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CrowdFunding API is running!',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// FIXED: Improved blockchain event listeners with better error handling
const Campaign = require('./models/Campaign');
const User = require('./models/User');

// Initialize blockchain connection with retry logic
let blockchainConnected = false;
let eventListenerCleanup = null;

const initializeBlockchainListeners = async () => {
  try {
    // FIXED: Check if blockchain utils exist before importing
    if (!fs.existsSync('./utils/blockchain.js')) {
      console.log('⚠️ Blockchain utilities not found, skipping event listeners');
      return;
    }
    
    // Import blockchain utils with error handling
    const { listenToContractEvents } = require('./utils/blockchain');
    
    console.log('🔗 Setting up blockchain event listeners...');
    
    eventListenerCleanup = listenToContractEvents(async (eventType, eventData) => {
      console.log(`📡 Blockchain Event: ${eventType}`, eventData);
      
      try {
        if (eventType === 'CampaignCreated') {
          // Update database when new campaign is created
          const campaign = await Campaign.findOne({ 
            contractId: parseInt(eventData.campaignId) 
          });
          
          if (campaign) {
            console.log(`✅ Campaign ${eventData.campaignId} already exists in database`);
          } else {
            console.log(`🆕 New campaign ${eventData.campaignId} detected, waiting for API creation`);
          }
        }
        
        if (eventType === 'DonationReceived') {
          // Update campaign and user data when donation received
          const campaign = await Campaign.findOne({ 
            contractId: parseInt(eventData.campaignId) 
          });
          
          if (campaign) {
            // Add donation to campaign
            campaign.donators.push({
              address: eventData.donator.toLowerCase(),
              amount: eventData.amount,
              timestamp: new Date()
            });
            
            campaign.totalDonations += 1;
            
            // FIXED: Better BigInt handling with fallback
            try {
              campaign.amountCollected = (
                BigInt(campaign.amountCollected || '0') + BigInt(eventData.amount)
              ).toString();
            } catch (bigintError) {
              console.warn('⚠️ BigInt error in event handler, using fallback:', bigintError);
              campaign.amountCollected = (
                parseFloat(campaign.amountCollected || '0') + parseFloat(eventData.amount)
              ).toString();
            }
            
            await campaign.save();
            
            // FIXED: Update user donation history with proper number handling
            try {
              await User.findOneAndUpdate(
                { address: eventData.donator.toLowerCase() },
                { 
                  $push: { 
                    campaignsDonated: {
                      campaignId: campaign._id,
                      amount: eventData.amount,
                      date: new Date()
                    }
                  },
                  $inc: { 
                    totalDonated: parseFloat(eventData.amount) || 0 // FIXED: Convert to number
                  }
                },
                { upsert: true, new: true }
              );
            } catch (userUpdateError) {
              console.error('⚠️ Failed to update user donation history:', userUpdateError);
            }
            
            console.log(`💰 Donation of ${eventData.amount} recorded for campaign ${eventData.campaignId}`);
          } else {
            console.warn(`⚠️ Campaign ${eventData.campaignId} not found in database for donation`);
          }
        }
      } catch (error) {
        console.error('❌ Error handling blockchain event:', error);
        // Don't throw error, just log it to prevent server crash
      }
    });
    
    blockchainConnected = true;
    console.log('✅ Blockchain event listeners initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize blockchain listeners:', error);
    blockchainConnected = false;
    
    // FIXED: Only retry if it's a connection error, not a missing file error
    if (!error.message.includes('Cannot find module')) {
      setTimeout(() => {
        console.log('🔄 Retrying blockchain connection...');
        initializeBlockchainListeners();
      }, 30000);
    } else {
      console.log('ℹ️ Blockchain utilities not available, running without event listeners');
    }
  }
};

// FIXED: Initialize blockchain listeners with delay and better error handling
setTimeout(() => {
  initializeBlockchainListeners();
}, 5000); // 5 second delay

// Error handling middleware
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
🚀 CrowdFunding Backend Server is running!
📡 Port: ${PORT}
🗄️  Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/crowdfunding'}
🌐 Environment: ${process.env.NODE_ENV || 'development'}
📝 Contract Address: ${process.env.CONTRACT_ADDRESS || 'Not configured'}
⛓️  Blockchain: ${blockchainConnected ? 'Connected' : 'Connecting...'}
☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Connected' : 'Not configured'}
  `);
});

// FIXED: Graceful shutdown with better cleanup
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, closing server gracefully...`);
  
  // Close blockchain event listeners
  if (eventListenerCleanup) {
    try {
      eventListenerCleanup();
      console.log('✅ Blockchain event listeners cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up blockchain listeners:', error);
    }
  }
  
  // Close server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forcefully shutting down after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// FIXED: Better error handling for unhandled promises and exceptions
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', err);
  // Don't exit the process for unhandled rejections in production
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development mode: Server will continue running');
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  } else {
    console.log('🔧 Development mode: Server will continue running');
  }
});