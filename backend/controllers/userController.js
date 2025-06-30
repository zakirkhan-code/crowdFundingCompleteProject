const Campaign = require('../models/Campaign');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log('👤 Fetching user profile for:', address);
    
    const user = await User.findOne({ address: address.toLowerCase() })
      .populate('campaignsCreated')
      .populate('campaignsDonated.campaignId');

    if (!user) {
      // FIXED: Create a default user response instead of 404
      console.log('ℹ️ User not found, returning default profile');
      return res.json({
        success: true,
        data: {
          address: address.toLowerCase(),
          name: null,
          email: null,
          bio: null,
          avatar: '',
          campaignsCreated: [],
          campaignsDonated: [],
          totalDonated: 0,
          totalRaised: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        message: 'User profile not found, returning default data'
      });
    }

    console.log('✅ User profile found');
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
};

// FIXED: Update user profile with better error handling
const updateUserProfile = async (req, res) => {
  try {
    const { address } = req.params;
    const { name, email, bio } = req.body;

    console.log('📝 Updating user profile for:', address);
    console.log('📊 Update data:', { name, email, bio });
    console.log('🖼️ Avatar upload:', req.file ? 'Yes' : 'No');

    let updateData = {
      name: name || null,
      email: email?.toLowerCase() || null,
      bio: bio || null
    };

    // Upload avatar if provided
    if (req.file) {
      try {
        console.log('📸 Uploading avatar to Cloudinary...');
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'crowdfunding/avatars',
          public_id: `avatar_${address}_${Date.now()}`,
          width: 300,
          height: 300,
          crop: 'fill'
        });
        updateData.avatar = result.secure_url;
        console.log('✅ Avatar uploaded successfully:', result.secure_url);
      } catch (uploadError) {
        console.error('❌ Avatar upload failed:', uploadError);
        // Continue without failing the entire update
      }
    }

    // FIXED: Better user update with proper options
    const user = await User.findOneAndUpdate(
      { address: address.toLowerCase() },
      updateData,
      { 
        new: true, 
        upsert: true,
        runValidators: true // FIXED: Run schema validators
      }
    );

    console.log('✅ User profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    
    // FIXED: Handle specific validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// FIXED: Get user statistics with better handling
const getUserStats = async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log('📊 Fetching user stats for:', address);
    
    const user = await User.findOne({ address: address.toLowerCase() });
    
    if (!user) {
      console.log('ℹ️ User not found, returning default stats');
      return res.json({
        success: true,
        data: {
          campaignsCreated: 0,
          totalRaised: 0, // FIXED: Return number instead of string
          campaignsDonated: 0,
          totalDonated: 0 // FIXED: Return number instead of string
        },
        message: 'User not found, returning default stats'
      });
    }

    // FIXED: Ensure all values are numbers
    const stats = {
      campaignsCreated: user.campaignsCreated ? user.campaignsCreated.length : 0,
      totalRaised: typeof user.totalRaised === 'number' ? user.totalRaised : parseFloat(user.totalRaised) || 0,
      campaignsDonated: user.campaignsDonated ? user.campaignsDonated.length : 0,
      totalDonated: typeof user.totalDonated === 'number' ? user.totalDonated : parseFloat(user.totalDonated) || 0
    };

    console.log('✅ User stats calculated:', stats);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user stats',
      error: error.message
    });
  }
};

// FIXED: Add new function to get user's campaigns
const getUserCampaigns = async (req, res) => {
  try {
    const { address } = req.params;
    const { type = 'created' } = req.query; // 'created' or 'donated'
    
    console.log('🎯 Fetching user campaigns:', { address, type });
    
    let campaigns = [];
    
    if (type === 'created') {
      // Get campaigns created by user
      campaigns = await Campaign.find({ 
        owner: address.toLowerCase() 
      }).sort({ createdAt: -1 });
    } else if (type === 'donated') {
      // Get campaigns user has donated to
      campaigns = await Campaign.find({
        'donators.address': address.toLowerCase()
      }).sort({ createdAt: -1 });
    }
    
    console.log(`✅ Found ${campaigns.length} campaigns for type: ${type}`);
    
    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length,
      type: type
    });
    
  } catch (error) {
    console.error('❌ Error fetching user campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user campaigns',
      error: error.message
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  getUserCampaigns // FIXED: Export new function
};