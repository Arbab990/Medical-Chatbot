import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function ChatBox({ sessionId, hasPDFs }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat history on component mount or session change
  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await axios.get(`http://localhost:5000/get_chat_history/${sessionId}`);
      
      if (response.data.success) {
        // Convert API format to component format
        const historyMessages = response.data.messages.flatMap(msg => [
          { sender: 'user', text: msg.user_message, timestamp: msg.timestamp },
          { sender: 'bot', text: msg.bot_response, timestamp: msg.timestamp, responseTime: msg.response_time_ms }
        ]);
        
        setMessages(historyMessages);
        console.log(`📜 Loaded ${response.data.messages.length} conversation pairs`);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setError('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError('');
    
    // Add user message immediately
    const userMsgObj = { 
      sender: 'user', 
      text: userMessage, 
      timestamp: new Date().toISOString() 
    };
    setMessages(prev => [...prev, userMsgObj]);
    
    // Add loading indicator
    const loadingMsgObj = { 
      sender: 'bot', 
      text: '🤔 Thinking...', 
      isLoading: true,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, loadingMsgObj]);
    
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/chat', {
        message: userMessage,
        session_id: sessionId,
      });

      if (response.data.success) {
        const botReply = response.data.reply;
        const responseTime = response.data.response_time_ms;
        const contextUsed = response.data.context_used;
        const sourcesCount = response.data.sources_count;

        // Remove loading message and add actual response
        setMessages(prev => {
          const withoutLoading = prev.filter(msg => !msg.isLoading);
          return [...withoutLoading, { 
            sender: 'bot', 
            text: botReply,
            responseTime: responseTime,
            contextUsed: contextUsed,
            sourcesCount: sourcesCount,
            timestamp: new Date().toISOString()
          }];
        });

        // Focus input for next message
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        throw new Error(response.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to get response';
      
      // Remove loading message and add error
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => !msg.isLoading);
        return [...withoutLoading, { 
          sender: 'bot', 
          text: `❌ Error: ${errorMessage}`,
          isError: true,
          timestamp: new Date().toISOString()
        }];
      });
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatBotText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearChat = async () => {
    if (window.confirm('Are you sure you want to clear this chat? This cannot be undone.')) {
      try {
        await axios.delete(`http://localhost:5000/clear_chat/${sessionId}`);
        setMessages([]);
        setError('');
        console.log('🗑️ Chat cleared');
      } catch (error) {
        console.error('Failed to clear chat:', error);
        setError('Failed to clear chat');
      }
    }
  };

  if (isLoadingHistory) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>💬 Chat Interface</h3>
        <div style={styles.headerControls}>
          {!hasPDFs && (
            <span style={styles.noPDFWarning}>
              ⚠️ No PDFs uploaded - responses will be general only
            </span>
          )}
          {messages.length > 0 && (
            <button onClick={clearChat} style={styles.clearButton}>
              🗑️ Clear Chat
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <span>❌ {error}</span>
          <button onClick={() => setError('')} style={styles.closeError}>×</button>
        </div>
      )}

      <div style={styles.chatWindow} id="chat-window">
        {messages.length === 0 ? (
          <div style={styles.welcomeMessage}>
            <div style={styles.welcomeIcon}>🩺</div>
            <h4>Welcome to your Medical Assistant!</h4>
            <p>
              {hasPDFs 
                ? "I can help answer questions based on your uploaded medical documents. Ask me anything!"
                : "Upload some PDF documents first to get contextual medical assistance, or ask general medical questions."
              }
            </p>
            <div style={styles.sampleQuestions}>
              <p><strong>Sample questions:</strong></p>
              <ul>
                <li>"What are the symptoms of diabetes?"</li>
                <li>"Explain the treatment options mentioned in my documents"</li>
                <li>"What should I know about blood pressure management?"</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.isError 
                  ? '#fee2e2' 
                  : msg.sender === 'user' 
                  ? '#dbeafe' 
                  : msg.isLoading 
                  ? '#f3f4f6' 
                  : '#f0fdf4',
                borderColor: msg.isError 
                  ? '#fca5a5' 
                  : msg.sender === 'user' 
                  ? '#93c5fd' 
                  : '#86efac',
              }}
            >
              <div style={styles.messageHeader}>
                <span style={styles.sender}>
                  <strong>{msg.sender === 'user' ? '👤 You' : '🤖 Medical Assistant'}</strong>
                </span>
                <span style={styles.timestamp}>
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
              
              <div style={styles.messageContent}>
                {msg.isLoading ? (
                  <div style={styles.loadingMessage}>
                    <div style={styles.miniSpinner}></div>
                    <span>{msg.text}</span>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: formatBotText(msg.text) }} />
                )}
              </div>

              {/* Show metadata for bot messages */}
              {msg.sender === 'bot' && !msg.isLoading && !msg.isError && (
                <div style={styles.messageMetadata}>
                  {msg.responseTime && (
                    <span style={styles.metadataItem}>
                      ⏱️ {msg.responseTime}ms
                    </span>
                  )}
                  {msg.contextUsed && (
                    <span style={styles.metadataItem}>
                      📄 Used document context
                    </span>
                  )}
                  {msg.sourcesCount > 0 && (
                    <span style={styles.metadataItem}>
                      📚 {msg.sourcesCount} source{msg.sourcesCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <textarea
          ref={inputRef}
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasPDFs 
            ? "Ask questions about your documents or general medical topics..." 
            : "Ask general medical questions (upload PDFs for contextual answers)..."
          }
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          rows={input.split('\n').length}
          maxLength={1000}
        />
        <button 
          onClick={sendMessage} 
          style={{
            ...styles.sendButton,
            opacity: isLoading || !input.trim() ? 0.5 : 1,
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer'
          }}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? (
            <div style={styles.miniSpinner}></div>
          ) : (
            '📤 Send'
          )}
        </button>
      </div>

      <div style={styles.inputFooter}>
        <span style={styles.charCount}>
          {input.length}/1000 characters
        </span>
        <span style={styles.enterHint}>
          Press Enter to send, Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '600px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  noPDFWarning: {
    fontSize: '12px',
    color: '#f59e0b',
    fontWeight: '500',
  },
  clearButton: {
    padding: '0.25rem 0.5rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#fee2e2',
    borderLeft: '4px solid #dc2626',
    color: '#7f1d1d',
    fontSize: '14px',
  },
  closeError: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#7f1d1d',
  },
  chatWindow: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    overflowY: 'auto',
    backgroundColor: '#ffffff',
    gap: '1rem',
  },
  welcomeMessage: {
    textAlign: 'center',
    padding: '2rem',
    color: '#6b7280',
  },
  welcomeIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  sampleQuestions: {
    textAlign: 'left',
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    fontSize: '14px',
  },
  message: {
    padding: '1rem',
    borderRadius: '12px',
    maxWidth: '85%',
    fontSize: '15px',
    lineHeight: '1.6',
    fontFamily: 'Arial, sans-serif',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    fontSize: '12px',
  },
  sender: {
    fontWeight: '600',
  },
  timestamp: {
    color: '#6b7280',
    fontSize: '11px',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  messageMetadata: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid rgba(0,0,0,0.1)',
    fontSize: '11px',
    color: '#6b7280',
  },
  metadataItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  loadingMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  inputContainer: {
    display: 'flex',
    padding: '1rem',
    gap: '0.5rem',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  input: {
    flex: 1,
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'none',
    minHeight: '40px',
    maxHeight: '120px',
    fontFamily: 'Arial, sans-serif',
  },
  sendButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  inputFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 1rem',
    fontSize: '11px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
  },
  charCount: {
    fontWeight: '500',
  },
  enterHint: {
    fontStyle: 'italic',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    gap: '1rem',
    color: '#6b7280',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  miniSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default ChatBox;



