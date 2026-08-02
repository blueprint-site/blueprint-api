const express = require('express');
const router = express.Router();
const schematicsController = require('../controllers/schematicsController');

router.post('/add', schematicsController.addSchematic);
router.get('/:id', schematicsController.getSchematic);
router.delete('/:id', schematicsController.deleteSchematic);

module.exports = router;
