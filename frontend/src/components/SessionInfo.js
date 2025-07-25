import React, { useState } from 'react';

function SessionInfo({ sessionInfo, onRefresh }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionDuration = () => {
    const created = new Date(sessionInfo.created_at);
    const lastActivity = new Date(sessionInfo.last_activity);
    const durationMs = lastActivity - created;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes} minutes`;
    } else {
      return 'Just started';
    }
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionInfo.session_id);
    // Could add a toast notification here
  };

  if (!sessionInfo) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={styles.headerLeft}>
          <span style={styles.icon}>🔗</span>
          <div style={styles.headerInfo}>
            <span style={styles.title}>Session Active</span>
            <span style={styles.subtitle}>
              {sessionInfo.pdf_count} PDF{sessionInfo.pdf_count !== 1 ? 's' : ''} • {' '}
              {sessionInfo.message_count} message{sessionInfo.message_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button onClick={(e) => { e.stopPropagation(); onRefresh(); }} style={styles.refreshButton}>
            🔄
          </button>
          <span style={styles.expandIcon}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div style={styles.expandedContent}>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Session ID:</span>
              <div style={styles.sessionIdContainer}>
                <code style={styles.sessionId}>
                  {sessionInfo.session_id.slice(0, 8)}...{sessionInfo.session_id.slice(-8)}
                </code>
                <button onClick={copySessionId} style={styles.copyButton} title="Copy full session ID">
                  📋
                </button>
              </div>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Created:</span>
              <span style={styles.infoValue}>
                {formatDate(sessionInfo.created_at)}
              </span>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Last Activity:</span>
              <span style={styles.infoValue}>
                {formatDate(sessionInfo.last_activity)}
              </span>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Duration:</span>
              <span style={styles.infoValue}>
                {getSessionDuration()}
              </span>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Documents:</span>
              <span style={styles.infoValue}>
                {sessionInfo.pdf_count} uploaded
              </span>
            </div>

            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Conversations:</span>
              <span style={styles.infoValue}>
                {sessionInfo.message_count} exchanges
              </span>
            </div>
          </div>

          <div style={styles.sessionActions}>
            <div style={styles.sessionStatus}>
              <span style={styles.statusIndicator}>🟢</span>
              <span style={styles.statusText}>Session is active and ready</span>
            </div>
          </div>

          <div style={styles.sessionNote}>
            <span style={styles.noteIcon}>💡</span>
            <span style={styles.noteText}>
              Your session data is automatically saved. You can close and reopen your browser 
              to continue where you left off.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginBottom: '1.5rem',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    borderBottom: '1px solid #e5e7eb',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  icon: {
    fontSize: '18px',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  subtitle: {
    fontSize: '12px',
    color: '#6b7280',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  refreshButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#6b7280',
    transition: 'transform 0.2s',
  },
  expandedContent: {
    padding: '1rem',
    backgroundColor: '#fff',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  infoLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoValue: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: '500',
  },
  sessionIdContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sessionId: {
    fontSize: '12px',
    fontFamily: 'Monaco, "Courier New", monospace',
    backgroundColor: '#f3f4f6',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    color: '#374151',
  },
  copyButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  sessionActions: {
    padding: '0.75rem',
    backgroundColor: '#f0fdf4',
    borderRadius: '6px',
    border: '1px solid #bbf7d0',
    marginBottom: '1rem',
  },
  sessionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  statusIndicator: {
    fontSize: '8px',
  },
  statusText: {
    fontSize: '13px',
    color: '#065f46',
    fontWeight: '500',
  },
  sessionNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.75rem',
    backgroundColor: '#fef3c7',
    borderRadius: '6px',
    border: '1px solid #fed7aa',
  },
  noteIcon: {
    fontSize: '14px',
    flexShrink: 0,
    marginTop: '0.125rem',
  },
  noteText: {
    fontSize: '12px',
    color: '#92400e',
    lineHeight: '1.4',
  },
};

export default SessionInfo;