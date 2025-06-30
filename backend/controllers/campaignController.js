const Campaign = require('../models/Campaign');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// Get all campaigns
const getAllCampaigns = async (req, res) => {
  try {
    const { category, status, sort } = req.query;
    let query = {};

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by status
    if (status) {
      const now = new Date();
      if (status === 'active') {
        query.deadline = { $gt: now };
      } else if (status === 'ended') {
        query.deadline = { $lte: now };
      }
    }

    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'ending':
        sortOption = { deadline: 1 };
        break;
      case 'amount':
        sortOption = { target: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const campaigns = await Campaign.find(query).sort(sortOption);

    res.json({
      success: true,
      count: campaigns.length,
      data: campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching campaigns',
      error: error.message
    });
  }
};

// Get single campaign
const getCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by MongoDB _id first, then by contractId
    let campaign = await Campaign.findById(id);
    
    if (!campaign) {
      // Try to find by contractId
      campaign = await Campaign.findOne({ contractId: parseInt(id) });
    }
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching campaign',
      error: error.message
    });
  }
};

// Create new campaign - FIXED WITH BETTER ERROR HANDLING
const createCampaign = async (req, res) => {
  try {
    console.log('📝 Creating campaign with data:', req.body);
    console.log('📎 File upload:', req.file ? 'Yes' : 'No');

    const {
      contractId,
      owner,
      title,
      description,
      target,
      deadline,
      category,
      transactionHash
    } = req.body;

    // Validate required fields
    if (!contractId && contractId !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID is required'
      });
    }

    if (!owner) {
      return res.status(400).json({
        success: false,
        message: 'Owner address is required'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Campaign title is required'
      });
    }

    // Check if campaign already exists
    const existingCampaign = await Campaign.findOne({ contractId: parseInt(contractId) });
    if (existingCampaign) {
      console.log('⚠️ Campaign already exists:', contractId);
      return res.status(409).json({
        success: false,
        message: 'Campaign with this contract ID already exists',
        data: existingCampaign
      });
    }

    // Handle image upload
    let imageUrl = 'https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?w=500&h=300&fit=crop'; // Default image

    if (req.file) {
      try {
        console.log('📸 Uploading image to Cloudinary...');
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'crowdfunding/campaigns',
          public_id: `campaign_${contractId}_${Date.now()}`,
          transformation: [
            { width: 500, height: 300, crop: 'fill' }
          ]
        });
        imageUrl = result.secure_url;
        console.log('✅ Image uploaded successfully:', imageUrl);
      } catch (uploadError) {
        console.error('❌ Image upload failed:', uploadError);
        // Continue with default image
      }
    }

    // Create campaign object
    const campaignData = {
      contractId: parseInt(contractId),
      owner: owner.toLowerCase(),
      title: title || 'Untitled Campaign',
      description: description || 'No description provided',
      target: target || '0',
      deadline: deadline ? new Date(parseInt(deadline) * 1000) : new Date(),
      image: imageUrl,
      category: category || 'other',
      amountCollected: '0',
      donators: [],
      totalDonations: 0,
      withdrawn: false
    };

    console.log('💾 Saving campaign to database:', campaignData);

    // Create and save campaign
    const campaign = new Campaign(campaignData);
    const savedCampaign = await campaign.save();

    console.log('✅ Campaign saved successfully:', savedCampaign._id);

    // FIXED: Update user's campaigns with better error handling
    try {
      await User.findOneAndUpdate(
        { address: owner.toLowerCase() },
        { 
          $push: { campaignsCreated: savedCampaign._id },
          $inc: { totalRaised: 0 } // FIXED: Use 0 instead of string
        },
        { upsert: true, new: true }
      );
      console.log('✅ User profile updated');
    } catch (userError) {
      console.error('⚠️ Failed to update user profile:', userError);
      // Don't fail the campaign creation for this
    }

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: savedCampaign
    });

  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Campaign with this contract ID already exists'
      });
    }

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
      message: 'Error creating campaign',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// FIXED: Update campaign with donation - Better BigInt handling
const updateCampaignDonation = async (req, res) => {
  try {
    const { campaignId, donator, amount, transactionHash } = req.body;

    console.log('💰 Recording donation:', {
      campaignId,
      donator,
      amount,
      transactionHash
    });

    // Find campaign by contractId
    const campaign = await Campaign.findOne({ contractId: parseInt(campaignId) });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Add new donation
    campaign.donators.push({
      address: donator.toLowerCase(),
      amount: amount,
      timestamp: new Date(),
      transactionHash: transactionHash
    });

    campaign.totalDonations += 1;
    
    // FIXED: Better BigInt handling with fallback
    try {
      const currentAmount = BigInt(campaign.amountCollected || '0');
      const newAmount = BigInt(amount);
      campaign.amountCollected = (currentAmount + newAmount).toString();
    } catch (bigintError) {
      console.warn('⚠️ BigInt error, using fallback calculation:', bigintError);
      // Fallback to regular number calculation
      const currentAmount = parseFloat(campaign.amountCollected || '0');
      const newAmount = parseFloat(amount);
      campaign.amountCollected = (currentAmount + newAmount).toString();
    }

    await campaign.save();

    console.log('✅ Donation recorded successfully');

    // FIXED: Update donator's profile with proper number handling
    try {
      await User.findOneAndUpdate(
        { address: donator.toLowerCase() },
        { 
          $push: { 
            campaignsDonated: {
              campaignId: campaign._id,
              amount: amount,
              date: new Date(),
              transactionHash: transactionHash
            }
          },
          $inc: { 
            totalDonated: parseFloat(amount) || 0 // FIXED: Convert to number
          }
        },
        { upsert: true, new: true }
      );
      console.log('✅ Donator profile updated');
    } catch (userError) {
      console.error('⚠️ Failed to update donator profile:', userError);
      // Continue even if user update fails
    }

    res.json({
      success: true,
      message: 'Donation recorded successfully',
      data: campaign
    });

  } catch (error) {
    console.error('❌ Error updating campaign donation:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating campaign donation',
      error: error.message
    });
  }
};

// Sync campaigns with blockchain
const syncWithBlockchain = async (req, res) => {
  try {
    console.log('🔄 Syncing campaigns with blockchain...');
    
    // This would require blockchain utility functions
    // For now, just return success
    res.json({
      success: true,
      message: 'Sync endpoint available',
      note: 'Blockchain sync functionality needs to be implemented'
    });
    
  } catch (error) {
    console.error('❌ Error syncing with blockchain:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing with blockchain',
      error: error.message
    });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaign,
  createCampaign,
  updateCampaignDonation,
  syncWithBlockchain
};