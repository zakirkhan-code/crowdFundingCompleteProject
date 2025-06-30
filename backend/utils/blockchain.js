const { ethers } = require('ethers');
const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "campaignId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "title",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "target",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "CampaignCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "campaignId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "donator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "DonationReceived",
    "type": "event"
  },
  // Add more ABI functions as needed
  {
    "inputs": [],
    "name": "getCampaigns",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address payable",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "target",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountCollected",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "image",
            "type": "string"
          },
          {
            "internalType": "address[]",
            "name": "donators",
            "type": "address[]"
          },
          {
            "internalType": "uint256[]",
            "name": "donations",
            "type": "uint256[]"
          },
          {
            "internalType": "bool",
            "name": "withdrawn",
            "type": "bool"
          }
        ],
        "internalType": "struct CrowdFunding.Campaign[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "getDonators",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

let provider = null;
let contract = null;
let isInitialized = false;

// Initialize blockchain connection with robust error handling
const initializeBlockchain = () => {
  try {
    if (!process.env.SEPOLIA_RPC_URL) {
      throw new Error('SEPOLIA_RPC_URL not configured in environment variables');
    }
    
    if (!process.env.CONTRACT_ADDRESS) {
      throw new Error('CONTRACT_ADDRESS not configured in environment variables');
    }

    // Create provider with proper error handling
    provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL, {
      name: 'sepolia',
      chainId: 11155111
    });
    // Set up provider error handling
    provider.on('error', (error) => {
      console.error('❌ Provider error:', error);
    });

    // Create contract instance
    contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    isInitialized = true;
    console.log('✅ Blockchain connection initialized');
    console.log('📄 Contract Address:', process.env.CONTRACT_ADDRESS);
    console.log('🌐 RPC URL:', process.env.SEPOLIA_RPC_URL.substring(0, 50) + '...');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize blockchain connection:', error);
    isInitialized = false;
    return false;
  }
};

// Get all campaigns from blockchain
const getCampaignsFromBlockchain = async () => {
  try {
    if (!isInitialized && !initializeBlockchain()) {
      throw new Error('Blockchain not initialized');
    }

    console.log('📡 Fetching campaigns from blockchain...');
    const campaigns = await contract.getCampaigns();
    console.log(`✅ Found ${campaigns.length} campaigns on blockchain`);
    return campaigns;
  } catch (error) {
    console.error('❌ Error fetching campaigns from blockchain:', error);
    throw error;
  }
};

// Get donators for a specific campaign
const getDonatorsFromBlockchain = async (campaignId) => {
  try {
    if (!isInitialized && !initializeBlockchain()) {
      throw new Error('Blockchain not initialized');
    }

    const [donators, donations] = await contract.getDonators(campaignId);
    return { donators, donations };
  } catch (error) {
    console.error('❌ Error fetching donators from blockchain:', error);
    throw error;
  }
};

// FIXED: Robust event listener with proper cleanup and error handling
const listenToContractEvents = (callback) => {
  if (!isInitialized && !initializeBlockchain()) {
    console.error('❌ Cannot set up event listeners: Blockchain not initialized');
    return () => {}; // Return empty cleanup function
  }

  console.log('🎧 Setting up contract event listeners...');
  
  let campaignCreatedListener = null;
  let donationReceivedListener = null;
  let reconnectTimeout = null;
  let cleanedUp = false;

  const setupListeners = () => {
    try {
      // Clean up existing listeners
      if (campaignCreatedListener) {
        contract.off('CampaignCreated', campaignCreatedListener);
      }
      if (donationReceivedListener) {
        contract.off('DonationReceived', donationReceivedListener);
      }

      // Campaign Created Event Listener
      campaignCreatedListener = (campaignId, owner, title, target, deadline, event) => {
        try {
          console.log('📢 CampaignCreated event received:', {
            campaignId: campaignId.toString(),
            owner,
            title
          });
          
          if (callback && typeof callback === 'function') {
            callback('CampaignCreated', {
              campaignId: campaignId.toString(),
              owner,
              title,
              target: target.toString(),
              deadline: deadline.toString(),
              transactionHash: event.transactionHash
            });
          }
        } catch (error) {
          console.error('❌ Error processing CampaignCreated event:', error);
        }
      };

      // Donation Received Event Listener
      donationReceivedListener = (campaignId, donator, amount, event) => {
        try {
          console.log('💰 DonationReceived event received:', {
            campaignId: campaignId.toString(),
            donator,
            amount: amount.toString()
          });
          
          if (callback && typeof callback === 'function') {
            callback('DonationReceived', {
              campaignId: campaignId.toString(),
              donator,
              amount: amount.toString(),
              transactionHash: event.transactionHash
            });
          }
        } catch (error) {
          console.error('❌ Error processing DonationReceived event:', error);
        }
      };

      // Attach listeners with error handling
      contract.on('CampaignCreated', campaignCreatedListener);
      contract.on('DonationReceived', donationReceivedListener);

      // Set up provider error handling
      provider.on('error', (error) => {
        console.error('❌ Provider connection error:', error);
        
        if (!cleanedUp) {
          // Attempt to reconnect after 10 seconds
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            console.log('🔄 Attempting to reconnect event listeners...');
            setupListeners();
          }, 10000);
        }
      });

      console.log('✅ Event listeners set up successfully');
      
    } catch (error) {
      console.error('❌ Error setting up event listeners:', error);
      
      // Retry after 15 seconds
      if (!cleanedUp) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          console.log('🔄 Retrying event listener setup...');
          setupListeners();
        }, 15000);
      }
    }
  };

  // Initial setup
  setupListeners();

  // Return cleanup function
  return () => {
    cleanedUp = true;
    console.log('🧹 Cleaning up event listeners...');
    
    try {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (contract) {
        // Remove specific listeners
        if (campaignCreatedListener) {
          contract.off('CampaignCreated', campaignCreatedListener);
        }
        if (donationReceivedListener) {
          contract.off('DonationReceived', donationReceivedListener);
        }
        
        // Remove all listeners as fallback
        contract.removeAllListeners();
      }
      
      if (provider) {
        provider.removeAllListeners();
      }
      
      console.log('✅ Event listeners cleaned up successfully');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  };
};

// Test blockchain connection
const testBlockchainConnection = async () => {
  try {
    if (!isInitialized && !initializeBlockchain()) {
      return false;
    }

    // Test by getting block number
    const blockNumber = await provider.getBlockNumber();
    console.log('✅ Blockchain connection test successful. Current block:', blockNumber);
    return true;
  } catch (error) {
    console.error('❌ Blockchain connection test failed:', error);
    return false;
  }
};

module.exports = {
  getCampaignsFromBlockchain,
  getDonatorsFromBlockchain,
  listenToContractEvents,
  testBlockchainConnection,
  initializeBlockchain,
  contract,
  provider
};