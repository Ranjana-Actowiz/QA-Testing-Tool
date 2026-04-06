const mongoose = require('mongoose');

const SavedRuleSetSchema = new mongoose.Schema(
  {
    feedName: { type: String, required: true, trim: true, unique: true },
    // Stored in UI-format (columnRules React state) so it can be loaded back directly
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },
    totalColumns: { type: Number, default: 0 },
    totalRules: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedRuleSet', SavedRuleSetSchema);
