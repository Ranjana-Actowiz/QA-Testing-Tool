import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { uploadFile } from '../services/api';
import { FileSpreadsheetIcon, UploadCloudIcon, XIcon } from '../icon/icon';
import { formatFileSize, getFileExtension } from '../utlis/utlis';

export default function FileUpload() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);


  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error(`File rejected: ${rejected[0].errors?.[0]?.message || 'Invalid file type'}`);
      return;
    }
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setUploadError(null);
      setProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
      'text/json': ['.json'],
    },
    multiple: false,
  });

  const handleReset = () => {
    setFile(null);
    setUploadError(null);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await uploadFile(formData, pct => setProgress(pct));
      const data = res?.data;
      const id = data?.uploadId || data?._id;
      navigate(`/upload/${id}`);
    } catch (err) {
      const msg = err.displayMessage || 'Upload failed. Please try again.';
      setUploadError(msg);
      toast.error(msg);
      setUploading(false);
    }
  };

  return (
    <div className="px-3 sm:px-6 pb-6 pt-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-4">
        {/* Top bar */}
        <div className="h-1 bg-gradient-to-r from-slate-500 via-slate-400 to-slate-400" />

        {/* Header */}
        <div className="px-6 pt-3 pb-1 flex items-center justify-between border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Upload Data File</h2>
            <p className="text-xs text-slate-400 mt-0.5">CSV, Excel or JSON</p>
          </div>
          <div className="flex gap-1.5">
            {['.csv', '.xlsx', '.xls', '.json'].map(ext => (
              <span key={ext} className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-600">{ext}</span>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div className="p-6">
          <div {...getRootProps({
            className: [
              'border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-all duration-200 outline-none',
              isDragReject ? 'border-red-400 bg-red-50' : isDragActive ? 'border-[#3F4D67] bg-[#3F4D67]/5' : 'border-slate-200 hover:border-[#3F4D67]/40 hover:bg-slate-50',
            ].join(' '),
          })}>
            <input {...getInputProps()} />
            {isDragReject ? (
              <div>
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                  <XIcon size={18} />
                </div>
                <p className="text-sm font-semibold text-red-500">Invalid file type</p>
                <p className="text-xs text-red-400 mt-0.5">Only CSV, Excel, and JSON files accepted</p>
              </div>
            ) : isDragActive ? (
              <div>
                <div className="w-8 h-8 mx-auto mb-2 rounded-xl bg-[#3F4D67] flex items-center justify-center text-white">
                  <UploadCloudIcon size={18} />
                </div>
                <p className="text-sm font-semibold text-blue-600">Drop to upload</p>
              </div>
            ) : (
              <div>
                <div className="w-8 h-8 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <UploadCloudIcon size={18} />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-0.5">Drag &amp; drop your file here</p>
                <p className="text-xs text-slate-400 mb-3">or click to browse</p>
                <span className="inline-flex items-center gap-1.5 bg-[#3F4D67] hover:bg-[#344057] text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors">
                  Browse Files
                </span>
              </div>
            )}
          </div>

          {/* Selected file preview */}
          {file && !uploading && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <FileSpreadsheetIcon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{file.name}</div>
                <div className="text-xs text-slate-400">{formatFileSize(file.size)} &middot; {getFileExtension(file.name)}</div>
              </div>
              <button onClick={handleReset} className="text-slate-400 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer">
                <XIcon size={14} />
              </button>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[70%]">{file?.name}</span>
                <span className="text-xs font-bold text-blue-600">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="progress-shimmer h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                {progress < 100 ? 'Uploading...' : 'Processing on server...'}
              </p>
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{uploadError}</span>
            </div>
          )}

          {/* Upload button */}
          {file && !uploading && (
            <div className="mt-5">
              <button
                onClick={handleUpload}
                className="w-full flex items-center justify-center gap-2 bg-[#3F4D67] hover:bg-[#344057] text-white font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer border-none"
              >
                <UploadCloudIcon size={16} /> Upload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
