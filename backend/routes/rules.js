const express = require('express');
const router = express.Router();
const { saveRuleSet, listRuleSets, deleteRuleSet, updateRuleSet } = require('../controllers/rulesController');

// GET  /api/rules — list all saved feeds
router.get('/', listRuleSets);

// POST /api/rules/save — save a new feed
router.post('/save', saveRuleSet);

// PUT /api/rules/:id — overwrite rules of an existing feed
router.put('/:id', updateRuleSet);

// DELETE /api/rules/:id — delete a saved feed
router.delete('/:id', deleteRuleSet);

module.exports = router;
