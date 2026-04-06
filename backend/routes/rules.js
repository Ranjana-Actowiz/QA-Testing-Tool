const express = require('express');
const router = express.Router();
const { saveRuleSet, listRuleSets, deleteRuleSet } = require('../controllers/rulesController');

// GET  /api/rules — list all saved feeds
router.get('/', listRuleSets);

// POST /api/rules/save — save a new feed
router.post('/save', saveRuleSet);

// DELETE /api/rules/:id — delete a saved feed
router.delete('/:id', deleteRuleSet);

module.exports = router;
