const mongoose = require('mongoose');



const ErrorDetailSchema = new mongoose.Schema(
  {
    column: { type: String },
    rule: { type: String },
    message: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const RowResultSchema = new mongoose.Schema(
  {
    rowIndex: { type: Number },
    status: {
      type: String,
      enum: ['pass', 'fail'],
    },
    errors: {
      type: [ErrorDetailSchema],
      default: [],
    },
  },
  { _id: false }
);

const SummaryItemSchema = new mongoose.Schema(
  {
    column: { type: String },
    rule: { type: String },
    failCount: { type: Number, default: 0 },
    passCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const ValidationReportSchema = new mongoose.Schema(
  {
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Upload',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    passedRows: {
      type: Number,
      default: 0,
    },
    failedRows: {
      type: Number,
      default: 0,
    },
    rules: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    results: {
      type: [RowResultSchema],
      default: [],
    },
    summary: {
      type: [SummaryItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookup by uploadId
ValidationReportSchema.index({ uploadId: 1 });

module.exports = mongoose.model('ValidationReport', ValidationReportSchema);
