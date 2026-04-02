const mongoose = require('mongoose');

const UploadSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true,  trim: true, },
    originalName: { type: String, required: true, trim: true, },
    uploadDate: { type: Date, default: Date.now,  },
    headers: { type: [String], default: [], },
    totalRows: { type: Number, default: 0,  },
    filePath: { type: String, required: true, },
    fileSize: { type: Number, default: 0, },
    mimeType: { type: String, default: '', },
    status: { type: String, enum: ['uploaded', 'validated'],  default: 'uploaded', },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Upload', UploadSchema);
