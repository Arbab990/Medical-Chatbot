import React, { useState } from 'react';
import axios from 'axios';

function PDFManager({ pdfs, sessionId, onPDFRemoved }) {
  const [isRemoving, setIsRemoving] = useState({});
  const [error, setError] = useState('');

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const removePDF = async (pdfId, filename) => {
    if (!window.confirm(`Are you sure you want to remove "${filename}"? This will also remove all associated text chunks.`)) {
      return;
    }

    setIsRemoving(prev => ({ ...prev, [pdfId]: true }));
    setError('');

    try {
      const response = await axios.delete(`http://localhost:5000/remove_pdf/${sessionId}/${pdfId}`);
      
      if (response.data.success) {
        onPDFRemoved(pdfId);
        console.log(`🗑️ Removed PDF: ${filename}`);
      } else {
        throw new Error(response.data.error || 'Failed to remove PDF');
      }
    } catch (error) {
      console.error('Remove PDF error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to remove PDF';
      setError(`Failed to remove ${filename}: ${errorMessage}`);
    } finally {
      setIsRemoving(prev => ({ ...prev, [pdfId]: false }));
    }
  };

  const getTotalSize = () => {
    return pdfs.reduce((total, pdf) => total + pdf.file_size, 0);
  };

  const getTotalChunks = () => {
    return pdfs.reduce((total, pdf) => total + (pdf.chunk_count || 0), 0);
  };

  if (pdfs.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>📚 Uploaded Documents ({pdfs.length})</h4>
        <div style={styles.stats}>
          <span style={styles.stat}>
            📊 Total: {formatFileSize(getTotalSize())}
          </span>
          <span style={styles.stat}>
            🧩 Chunks: {getTotalChunks()}
          </span>
        </div>
      </div>

      {error && (
        <div style={styles.errorMessage}>
          <span>❌ {error}</span>
          <button onClick={() => setError('')} style={styles.closeButton}>×</button>
        </div>
      )}

      <div style={styles.pdfGrid}>
        {pdfs.map((pdf) => (
          <div key={pdf.id} style={styles.pdfCard}>
            <div style={styles.pdfHeader}>
              <div style={styles.pdfIcon}>📄</div>
              <div style={styles.pdfInfo}>
                <div style={styles.pdfName} title={pdf.original_filename}>
                  {pdf.original_filename}
                </div>
                <div style={styles.pdfMeta}>
                  {formatFileSize(pdf.file_size)} • {formatDate(pdf.upload_time)}
                </div>
              </div>
              <button
                onClick={() => removePDF(pdf.id, pdf.original_filename)}
                disabled={isRemoving[pdf.id]}
                style={{
                  ...styles.removeButton,
                  opacity: isRemoving[pdf.id] ? 0.5 : 1,
                  cursor: isRemoving[pdf.id] ? 'not-allowed' : 'pointer'
                }}
                title="Remove PDF"
              >
                {isRemoving[pdf.id] ? (
                  <div style={styles.miniSpinner}></div>
                ) : (
                  '🗑️'
                )}
              </button>
            </div>

            <div style={styles.pdfStats}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Chunks:</span>
                <span style={styles.statValue}>{pdf.chunk_count || 0}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Status:</span>
                <span style={styles.statusBadge}>
                  ✅ Processed
                </span>
              </div>
            </div>

            <div style={styles.pdfActions}>
              <div style={styles.processingInfo}>
                <span style={styles.infoText}>
                  📝 Ready for Q&A • 🔍 Searchable content
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <div style={styles.footerText}>
          💡 <strong>Tip:</strong> All uploaded documents are automatically processed and made searchable. 
          Your questions will reference content from all these documents.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #f3f4f6',
  },
  title: {
    margin: 0,
    color: '#374151',
    fontSize: '16px',
  },
  stats: {
    display: 'flex',
    gap: '1rem',
  },
  stat: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
  },
  errorMessage: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    backgroundColor: '#fee2e2',
    borderLeft: '4px solid #ef4444',
    borderRadius: '4px',
    color: '#7f1d1d',
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
  pdfGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem',
  },
  pdfCard: {
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s',
  },
  pdfHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  pdfIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  pdfInfo: {
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
  pdfName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pdfMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'all 0.2s',
    flexShrink: 0,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSpinner: {
    width: '12px',
    height: '12px',
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #ef4444',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  pdfStats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
    padding: '0.5rem',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    border: '1px solid #86efac',
  },
  pdfActions: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '0.75rem',
  },
  processingInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: '11px',
    color: '#059669',
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    padding: '0.75rem 1rem',
    backgroundColor: '#f0f9ff',
    borderRadius: '6px',
    border: '1px solid #bae6fd',
  },
  footerText: {
    fontSize: '12px',
    color: '#0c4a6e',
    textAlign: 'center',
    lineHeight: '1.4',
  },
};

export default PDFManager;