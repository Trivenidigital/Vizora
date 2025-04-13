const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// System routes
router.get('/', protect, admin, (req, res) => {
  res.json({
    message: 'System routes'
  });
});

module.exports = router; 