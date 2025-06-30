const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getAllCampaigns,
  getCampaign,
  createCampaign,
  updateCampaignDonation,
  syncWithBlockchain
} = require('../controllers/campaignController');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
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
router.get('/', getAllCampaigns);
router.get('/sync', syncWithBlockchain);
router.get('/:id', getCampaign);
router.post('/', upload.single('image'), createCampaign);
router.post('/donation', updateCampaignDonation);

module.exports = router;