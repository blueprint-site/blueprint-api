const express = require('express');
const router = express.Router();
const addonsController = require('../controllers/addonsController');

// Route to get a specific addon by ID
router.get('/:id', addonsController.getAddon);

// Route to get all addons
router.get('/', addonsController.getAllAddons);

module.exports = router;
