import React, { useState, useRef } from 'react';
import axios from 'axios';

function UploadPDF({ sessionId, onPDFsUploaded }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate files
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // Check file type
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`${file.name} is not a PDF file`);
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name} is too large (max 10MB)`);
        return;
      }

      // Check if file already selected
      if (validFiles.some(f => f.name === file.name && f.size === file.size)) {
        errors.push(`${file.name} is already selected`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join(', '));
    } else {
      setError('');
    }

    setSelectedFiles(validFiles);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    if (!sessionId) {
      setError('Session not initialized');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');
    setUploadProgress({});

    try {
      const formData = new FormData();
      
      // Add session ID
      formData.append('session_id', sessionId);
      
      // Add all files
      selectedFiles.forEach((file, index) => {
        formData.append('files', file);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'uploading', progress: 0 }
        }));
      });

      // Upload with progress tracking
      const response = await axios.post('http://localhost:5000/upload_pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          
          // Update progress for all files (simplified)
          selectedFiles.forEach(file => {
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: { status: 'uploading', progress: percentCompleted }
            }));
          });
        },
      });

      console.log("PDF Upload Response:", response.data);

      if (response.data.success) {
        const uploadedPDFs = response.data.uploaded_pdfs;
        
        // Update progress to completed
        selectedFiles.forEach(file => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'completed', progress: 100 }
          }));
        });

        // Show success message
        setSuccess(`Successfully uploaded ${uploadedPDFs.length} PDF${uploadedPDFs.length !== 1 ? 's' : ''}`);
        
        // Notify parent component
        onPDFsUploaded(uploadedPDFs);
        
        // Clear form
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Show warnings if any
        if (response.data.warnings && response.data.warnings.length > 0) {
          setError(`Warnings: ${response.data.warnings.join(', ')}`);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);

      } else {
        throw new Error(response.data.error || 'Upload failed');
      }

    } catch (error) {
      console.error("Upload error:", error);
      
      // Update progress to failed
      selectedFiles.forEach(file => {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'failed', progress: 0 }
        }));
      });

      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      
      // Clear progress after 2 seconds
      setTimeout(() => setUploadProgress({}), 2000);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setError('');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setError('');
    setSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.uploadSection}>
        <div style={styles.inputGroup}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            style={styles.fileInput}
            disabled={isUploading}
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" style={styles.fileInputLabel}>
            📎 Choose PDF Files
          </label>
          <span style={styles.fileInputHint}>
            Multiple files allowed • Max 10MB each
          </span>
        </div>

        <div style={styles.buttonGroup}>
          <button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0 || isUploading}
            style={{
              ...styles.uploadButton,
              opacity: selectedFiles.length === 0 || isUploading ? 0.5 : 1,
              cursor: selectedFiles.length === 0 || isUploading ? 'not-allowed' : 'pointer'
            }}
          >
            {isUploading ? (
              <>
                <div style={styles.spinner}></div>
                Uploading...
              </>
            ) : (
              <>
                📤 Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
              </>
            )}
          </button>

          {selectedFiles.length > 0 && !isUploading && (
            <button onClick={clearAll} style={styles.clearButton}>
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div style={styles.filesList}>
          <h4 style={styles.filesListTitle}>
            Selected Files ({selectedFiles.length})
          </h4>
          {selectedFiles.map((file, index) => {
            const progress = uploadProgress[file.name];
            return (
              <div key={index} style={styles.fileItem}>
                <div style={styles.fileInfo}>
                  <div style={styles.fileName}>
                    📄 {file.name}
                  </div>
                  <div style={styles.fileSize}>
                    {formatFileSize(file.size)}
                  </div>
                </div>

                {/* Progress bar during upload */}
                {progress && (
                  <div style={styles.progressContainer}>
                    <div style={styles.progressBar}>
                      <div 
                        style={{
                          ...styles.progressFill,
                          width: `${progress.progress}%`,
                          backgroundColor: 
                            progress.status === 'completed' ? '#10b981' :
                            progress.status === 'failed' ? '#ef4444' : '#3b82f6'
                        }}
                      />
                    </div>
                    <span style={styles.progressText}>
                      {progress.status === 'completed' ? '✅ Done' :
                       progress.status === 'failed' ? '❌ Failed' :
                       `${progress.progress}%`}
                    </span>
                  </div>
                )}

                {!isUploading && !progress && (
                  <button
                    onClick={() => removeFile(index)}
                    style={styles.removeButton}
                    title="Remove file"
                  >
                    ❌
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div style={styles.errorMessage}>
          <span>❌ {error}</span>
          <button onClick={() => setError('')} style={styles.closeButton}>×</button>
        </div>
      )}

      {success && (
        <div style={styles.successMessage}>
          <span>✅ {success}</span>
          <button onClick={() => setSuccess('')} style={styles.closeButton}>×</button>
        </div>
      )}

      {/* Upload Tips */}
      <div style={styles.tips}>
        <h5 style={styles.tipsTitle}>💡 Upload Tips:</h5>
        <ul style={styles.tipsList}>
          <li>PDFs with clear text work best for analysis</li>
          <li>Medical documents, research papers, and reports are ideal</li>
          <li>Scanned documents may have limited text extraction</li>
          <li>Each file is processed into chunks for better search</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  uploadSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '2px dashed #cbd5e1',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  fileInput: {
    display: 'none',
  },
  fileInputLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
  fileInputHint: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  clearButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  filesList: {
    padding: '1rem',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  filesListTitle: {
    margin: '0 0 1rem 0',
    color: '#374151',
    fontSize: '16px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem',
    marginBottom: '0.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '0.25rem',
  },
  fileSize: {
    fontSize: '12px',
    color: '#6b7280',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    marginLeft: '1rem',
  },
  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
    borderRadius: '3px',
  },
  progressText: {
    fontSize: '11px',
    fontWeight: '500',
    minWidth: '50px',
    textAlign: 'right',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  errorMessage: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#fee2e2',
    borderLeft: '4px solid #ef4444',
    borderRadius: '4px',
    color: '#7f1d1d',
    fontSize: '14px',
  },
  successMessage: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#d1fae5',
    borderLeft: '4px solid #10b981',
    borderRadius: '4px',
    color: '#065f46',
    fontSize: '14px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    opacity: 0.7,
    transition: 'opacity 0.2s',
  },
  tips: {
    padding: '1rem',
    backgroundColor: '#fffbeb',
    borderRadius: '8px',
    border: '1px solid #fed7aa',
  },
  tipsTitle: {
    margin: '0 0 0.5rem 0',
    color: '#92400e',
    fontSize: '14px',
  },
  tipsList: {
    margin: 0,
    paddingLeft: '1.5rem',
    color: '#92400e',
    fontSize: '13px',
    lineHeight: '1.5',
  },
};

export default UploadPDF;



