const multer = require('multer');

// Simple wallet address verification middleware
const verifyWallet = (req, res, next) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(401).json({
        success: false,
        message: 'Wallet address required'
      });
    }

    // Basic Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Ethereum address'
      });
    }

    req.userAddress = address.toLowerCase();
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large'
      });
    }
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = {
  verifyWallet,
  errorHandler
};