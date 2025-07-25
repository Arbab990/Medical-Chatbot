from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pickle
import numpy as np

db = SQLAlchemy()

class ChatSession(db.Model):
    """Model to track user sessions"""
    __tablename__ = 'chat_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    pdfs = db.relationship('PDFDocument', backref='session', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('ChatMessage', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'created_at': self.created_at.isoformat(),
            'last_activity': self.last_activity.isoformat(),
            'pdf_count': len(self.pdfs),
            'message_count': len(self.messages)
        }

class PDFDocument(db.Model):
    """Model to store PDF document information"""
    __tablename__ = 'pdf_documents'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), db.ForeignKey('chat_sessions.session_id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)  # in bytes
    upload_time = db.Column(db.DateTime, default=datetime.utcnow)
    total_chunks = db.Column(db.Integer, default=0)
    
    # Relationships
    chunks = db.relationship('PDFChunk', backref='pdf_document', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'upload_time': self.upload_time.isoformat(),
            'total_chunks': self.total_chunks,
            'chunk_count': len(self.chunks)
        }

class PDFChunk(db.Model):
    """Model to store PDF text chunks and their embeddings"""
    __tablename__ = 'pdf_chunks'
    
    id = db.Column(db.Integer, primary_key=True)
    pdf_id = db.Column(db.Integer, db.ForeignKey('pdf_documents.id'), nullable=False)
    chunk_text = db.Column(db.Text, nullable=False)
    chunk_index = db.Column(db.Integer, nullable=False)
    chunk_size = db.Column(db.Integer, nullable=False)  # length of text
    embedding_data = db.Column(db.LargeBinary, nullable=False)  # pickled numpy array
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_embedding(self, embedding_vector):
        """Store embedding as pickled binary data"""
        self.embedding_data = pickle.dumps(embedding_vector.astype(np.float32))
    
    def get_embedding(self):
        """Retrieve embedding as numpy array"""
        return pickle.loads(self.embedding_data)
    
    def to_dict(self):
        return {
            'id': self.id,
            'pdf_id': self.pdf_id,
            'chunk_text': self.chunk_text[:200] + '...' if len(self.chunk_text) > 200 else self.chunk_text,
            'chunk_index': self.chunk_index,
            'chunk_size': self.chunk_size,
            'pdf_filename': self.pdf_document.filename if self.pdf_document else None
        }

class ChatMessage(db.Model):
    """Model to store chat conversation history"""
    __tablename__ = 'chat_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), db.ForeignKey('chat_sessions.session_id'), nullable=False)
    user_message = db.Column(db.Text, nullable=False)
    bot_response = db.Column(db.Text, nullable=False)
    context_used = db.Column(db.Text)  # Store which chunks were used for context
    relevant_pdfs = db.Column(db.String(500))  # Store PDF IDs that contributed to response
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    response_time_ms = db.Column(db.Integer)  # Track response time for analytics
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_message': self.user_message,
            'bot_response': self.bot_response,
            'timestamp': self.timestamp.isoformat(),
            'relevant_pdfs': self.relevant_pdfs.split(',') if self.relevant_pdfs else [],
            'response_time_ms': self.response_time_ms
        }

# Helper functions for database operations
def create_session(session_id):
    """Create a new chat session"""
    session = ChatSession(session_id=session_id)
    db.session.add(session)
    db.session.commit()
    return session

def get_session(session_id):
    """Get or create a session"""
    session = ChatSession.query.filter_by(session_id=session_id).first()
    if not session:
        session = create_session(session_id)
    else:
        # Update last activity
        session.last_activity = datetime.utcnow()
        db.session.commit()
    return session

def get_session_pdfs(session_id):
    """Get all PDFs for a session"""
    return PDFDocument.query.filter_by(session_id=session_id).all()

def get_session_chunks(session_id):
    """Get all chunks for a session"""
    return db.session.query(PDFChunk).join(PDFDocument).filter(
        PDFDocument.session_id == session_id
    ).all()

def get_chat_history(session_id, limit=50):
    """Get chat history for a session"""
    return ChatMessage.query.filter_by(session_id=session_id)\
                           .order_by(ChatMessage.timestamp.desc())\
                           .limit(limit).all()

def save_chat_message(session_id, user_message, bot_response, context_chunks=None, relevant_pdf_ids=None, response_time=None):
    """Save a chat message to database"""
    context_text = "\n---\n".join(context_chunks) if context_chunks else None
    pdf_ids_str = ",".join(map(str, relevant_pdf_ids)) if relevant_pdf_ids else None
    
    message = ChatMessage(
        session_id=session_id,
        user_message=user_message,
        bot_response=bot_response,
        context_used=context_text,
        relevant_pdfs=pdf_ids_str,
        response_time_ms=response_time
    )
    db.session.add(message)
    db.session.commit()
    return message

def delete_pdf_and_chunks(pdf_id):
    """Delete a PDF and all its chunks"""
    pdf = PDFDocument.query.get(pdf_id)
    if pdf:
        # Delete associated chunks (cascade should handle this, but being explicit)
        PDFChunk.query.filter_by(pdf_id=pdf_id).delete()
        db.session.delete(pdf)
        db.session.commit()
        return True
    return False

def clear_session_data(session_id):
    """Clear all data for a session (PDFs, chunks, messages)"""
    # Delete messages
    ChatMessage.query.filter_by(session_id=session_id).delete()
    
    # Delete PDFs and their chunks (cascade will handle chunks)
    PDFDocument.query.filter_by(session_id=session_id).delete()
    
    db.session.commit()

# Database initialization function
def init_database(app):
    """Initialize database with app context"""
    with app.app_context():
        db.create_all()
        print("✅ Database tables created successfully!")

# Optional: Add indexes for better performance
def create_indexes():
    """Create database indexes for better query performance"""
    try:
        db.session.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp ON chat_messages(session_id, timestamp)')
        db.session.execute('CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_id ON pdf_chunks(pdf_id)')
        db.session.execute('CREATE INDEX IF NOT EXISTS idx_pdf_documents_session ON pdf_documents(session_id)')
        db.session.commit()
        print("✅ Database indexes created successfully!")
    except Exception as e:
        print(f"⚠️ Could not create indexes: {e}")
        db.session.rollback()