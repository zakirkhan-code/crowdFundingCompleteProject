const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  getUserCampaigns // FIXED: Import new function
} = require('../controllers/userController');

const router = express.Router();

// Multer configuration for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for avatars
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes
router.get('/:address', getUserProfile);
router.get('/:address/stats', getUserStats);
router.get('/:address/campaigns', getUserCampaigns); // FIXED: Add new route
router.put('/:address', upload.single('avatar'), updateUserProfile);

module.exports = router;