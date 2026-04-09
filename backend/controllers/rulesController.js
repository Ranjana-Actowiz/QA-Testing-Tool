const SavedRuleSet = require('../models/SavedRuleSet');

/**
 * POST /api/rules/save
 * Body: { feedName: string, rules: object (UI-format columnRules) }
 */
const saveRuleSet = async (req, res) => {
  try {
    const { feedName, rules } = req.body;

    if (!feedName?.trim()) {
      return res.status(400).json({ success: false, message: 'feedName is required.' });
    }
    const prevFeedName = await SavedRuleSet.findOne({ feedName: feedName.trim() }).lean();
    if (prevFeedName) {
      return res.status(400).json({ success: false, message: 'Feedname already exists.' });
    }
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
      return res.status(400).json({ success: false, message: 'rules must be a non-empty object.' });
    }

    const totalColumns = Object.keys(rules).length;
    const totalRules = Object.values(rules).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);

    if (totalRules === 0) {
      return res.status(400).json({ success: false, message: 'No rules to save.' });
    }

    const ruleSet = new SavedRuleSet({ feedName: feedName.trim(), rules, totalColumns, totalRules });
    await ruleSet.save();

    return res.status(201).json({ success: true, data: ruleSet });
  } catch (error) {
    console.error('saveRuleSet error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/rules
 * Returns all saved rule sets sorted by newest first.
 */
const listRuleSets = async (req, res) => {
  try {
    const ruleSets = await SavedRuleSet.find({}, '_id feedName totalColumns totalRules createdAt rules')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, data: ruleSets });
  } catch (error) {
    console.error('listRuleSets error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/rules/:id
 */
const deleteRuleSet = async (req, res) => {
  try {
    const isPresent = await SavedRuleSet.findById(req.params.id).lean();
    if (!isPresent) {
      return res.status(404).json({ success: false, message: 'Rule set not found.' });
    }
    await SavedRuleSet.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true , message: 'Rule set deleted successfully.'});
  } catch (error) {
    console.error('deleteRuleSet error:', error);
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid ID.' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/rules/:id
 * Body: { rules: object (UI-format columnRules) }
 * Overwrites the rules of an existing feed without changing its name.
 */
const updateRuleSet = async (req, res) => {
  try {
    const { rules } = req.body;
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
      return res.status(400).json({ success: false, message: 'rules must be a non-empty object.' });
    }

    const totalColumns = Object.keys(rules).length;
    const totalRules = Object.values(rules).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);

    if (totalRules === 0) {
      return res.status(400).json({ success: false, message: 'No rules to save.' });
    }

    const updated = await SavedRuleSet.findByIdAndUpdate(
      req.params.id,
      { rules, totalColumns, totalRules },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Rule set not found.' });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('updateRuleSet error:', error);
    if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid ID.' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { saveRuleSet, listRuleSets, deleteRuleSet, updateRuleSet };
