import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChatBox from './components/Chatbot';
import UploadPDF from './components/UploadPDF';
import PDFManager from './components/PDFManager';
import SessionInfo from './components/SessionInfo';

function App() {
  const [sessionId, setSessionId] = useState('');
  const [uploadedPDFs, setUploadedPDFs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);

  // Initialize or restore session on component mount
  useEffect(() => {
    initializeSession();
  }, []);

  // Load PDFs whenever session changes
  useEffect(() => {
    if (sessionId) {
      loadSessionPDFs();
      loadSessionInfo();
    }
  }, [sessionId]);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      
      // Check if we have a stored session ID
      const storedSessionId = localStorage.getItem('medical_chatbot_session');
      
      if (storedSessionId) {
        // Try to use existing session
        setSessionId(storedSessionId);
        console.log('📱 Restored session:', storedSessionId);
      } else {
        // Create new session
        await createNewSession();
      }
    } catch (error) {
      console.error('Session initialization error:', error);
      setError('Failed to initialize session');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await axios.post('http://localhost:5000/create_session');
      const newSessionId = response.data.session_id;
      
      setSessionId(newSessionId);
      localStorage.setItem('medical_chatbot_session', newSessionId);
      console.log('🆕 Created new session:', newSessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  };

  const loadSessionPDFs = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/get_pdfs/${sessionId}`);
      if (response.data.success) {
        setUploadedPDFs(response.data.pdfs);
      }
    } catch (error) {
      console.error('Failed to load PDFs:', error);
    }
  };

  const loadSessionInfo = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/session_info/${sessionId}`);
      if (response.data.success) {
        setSessionInfo(response.data.session);
      }
    } catch (error) {
      console.error('Failed to load session info:', error);
    }
  };

  const handlePDFsUploaded = (newPDFs) => {
    setUploadedPDFs(prev => [...prev, ...newPDFs]);
    loadSessionInfo(); // Refresh session info
  };

  const handlePDFRemoved = (pdfId) => {
    setUploadedPDFs(prev => prev.filter(pdf => pdf.id !== pdfId));
    loadSessionInfo(); // Refresh session info
  };

  const handleNewSession = async () => {
    if (window.confirm('Are you sure you want to start a new session? This will clear all current data.')) {
      try {
        setIsLoading(true);
        
        // Clear current session from storage
        localStorage.removeItem('medical_chatbot_session');
        
        // Reset state
        setSessionId('');
        setUploadedPDFs([]);
        setSessionInfo(null);
        setError('');
        
        // Create new session
        await createNewSession();
      } catch (error) {
        setError('Failed to create new session');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClearSession = async () => {
    if (window.confirm('Are you sure you want to clear all data from this session? This cannot be undone.')) {
      try {
        setIsLoading(true);
        await axios.delete(`http://localhost:5000/clear_chat/${sessionId}`);
        
        // Refresh data
        setUploadedPDFs([]);
        setSessionInfo(null);
        await loadSessionInfo();
        
        alert('Session data cleared successfully!');
      } catch (error) {
        console.error('Failed to clear session:', error);
        setError('Failed to clear session data');
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>🔄 Initializing Medical Chatbot...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} style={styles.button}>
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
      <div style={styles.headerOverlay}>
        <h1>Healix-Medical Chatbot</h1>
        <div style={styles.sessionControls}>
          <button onClick={handleNewSession} style={styles.secondaryButton}>
            🆕 New Session
          </button>
          <button onClick={handleClearSession} style={styles.dangerButton}>
            🗑️ Clear All Data
          </button>
        </div>
      </div>
      </header>

      {/* Session Info */}
      {sessionInfo && (
        <SessionInfo 
          sessionInfo={sessionInfo} 
          onRefresh={loadSessionInfo}
        />
      )}

      {/* PDF Upload Section */}
      <section style={styles.sectionWrapper}>
        <div style={styles.sectionBackground}>
          <div style={styles.sectionOverlay}>
            <h2>📄 Document Management</h2>
            <UploadPDF 
              sessionId={sessionId} 
              onPDFsUploaded={handlePDFsUploaded}
            />
        
            {uploadedPDFs.length > 0 && (
              <PDFManager 
                pdfs={uploadedPDFs}
                sessionId={sessionId}
                onPDFRemoved={handlePDFRemoved}
              />
            )}
          </div>
        </div>
      </section>

      {/* Chat Section */}
      <section style={styles.section}>
        <ChatBox 
          sessionId={sessionId}
          hasPDFs={uploadedPDFs.length > 0}
        />
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>⚠️ <strong>Medical Disclaimer:</strong> This chatbot provides general information only. 
        Always consult qualified healthcare professionals for medical advice.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '1rem',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: 'auto',
    backgroundColor: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    padding: '1rem 2rem',
    backgroundImage: 'url("/backgroundimg.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#fff',
    borderRadius: '12px',
    zIndex: 1,
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  sessionControls: {
    display: 'flex',
    gap: '0.5rem',
  },
  section: {
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '1rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '2rem',
    backgroundColor: '#fee2e2',
    borderRadius: '12px',
    border: '1px solid #fca5a5',
  },
  button: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  secondaryButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  dangerButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  headerOverlay:{
      width: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      borderRadius: '12px',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',

  },
  sectionWrapper: {
  marginBottom: '2rem',
  borderRadius: '12px',
  overflow: 'hidden',
  position: 'relative',
},

sectionBackground: {
  backgroundImage: 'url("/backgroundimg.png")', // Your uploaded image
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  padding: '2rem',
},

sectionOverlay: {
  backgroundColor: 'rgba(255, 255, 255, 0.88)', // semi-transparent white
  borderRadius: '12px',
  padding: '1.5rem',
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
},

  
  footer: {
    marginTop: '2rem',
    padding: '1rem',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    border: '1px solid #f59e0b',
    textAlign: 'center',
    fontSize: '14px',
  },
};

// Add CSS animation for spinner
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);

export default App;



