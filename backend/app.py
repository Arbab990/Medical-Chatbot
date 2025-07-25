from flask import Flask, request, jsonify
import os
import fitz
import requests
import uuid
import time
from datetime import datetime
from dotenv import load_dotenv
from flask_cors import CORS
from werkzeug.utils import secure_filename
import numpy as np

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Import our database models
from models import (
    db, init_database, create_indexes,
    ChatSession, PDFDocument, PDFChunk, ChatMessage,
    get_session, get_session_pdfs, get_session_chunks,
    get_chat_history, save_chat_message, delete_pdf_and_chunks,
    clear_session_data
)

load_dotenv()

# Configuration
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
CORS(app)

# Database configuration
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///medical_chatbot.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-this')

# Initialize database
db.init_app(app)

# API Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Load embedding model
print("🔄 Loading embedding model...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
print("✅ Embedding model loaded successfully!")

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file"""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text.strip()
    except Exception as e:
        print(f"[PDF ERROR] Failed to extract text from: {pdf_path} | Error: {str(e)}")
        return ""

def chunk_text(text, max_chunk_size=400, overlap=50):
    """
    Chunk text with overlap for better context preservation
    """
    if not text.strip():
        return []
    
    sentences = text.split(". ")
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # Check if adding this sentence exceeds the limit
        if len(current_chunk) + len(sentence) + 2 < max_chunk_size:  # +2 for ". "
            current_chunk += sentence + ". "
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            
            # Start new chunk with overlap
            if len(chunks) > 0 and overlap > 0:
                # Take last few words from previous chunk for overlap
                prev_words = current_chunk.split()[-overlap//10:]  # Rough overlap
                current_chunk = " ".join(prev_words) + " " + sentence + ". "
            else:
                current_chunk = sentence + ". "
    
    # Add the last chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return [chunk for chunk in chunks if len(chunk.strip()) > 20]  # Filter very short chunks

@app.route("/create_session", methods=["POST"])
def create_session_endpoint():
    """Create a new chat session"""
    try:
        session_id = str(uuid.uuid4())
        session = get_session(session_id)
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "message": "Session created successfully"
        })
    except Exception as e:
        print(f"[SESSION ERROR] {str(e)}")
        return jsonify({"error": "Failed to create session"}), 500

@app.route("/upload_pdf", methods=["POST"])
def upload_pdf():
    """Upload multiple PDFs and process them for RAG"""
    try:
        # Get session ID
        session_id = request.form.get('session_id')
        if not session_id:
            return jsonify({"error": "Session ID required"}), 400
        
        # Ensure session exists
        session = get_session(session_id)
        
        if 'files' not in request.files:
            return jsonify({"error": "No files part"}), 400

        files = request.files.getlist("files")
        if not files or files[0].filename == '':
            return jsonify({"error": "No selected files"}), 400

        uploaded_pdfs = []
        processing_errors = []

        for file in files:
            try:
                # Secure filename and save file
                original_filename = file.filename
                filename = secure_filename(f"{session_id}_{int(time.time())}_{original_filename}")
                filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                file.save(filepath)
                
                file_size = os.path.getsize(filepath)
                print(f"[UPLOAD] Saved: {filepath}, Size: {file_size} bytes")

                # Extract text
                text = extract_text_from_pdf(filepath)
                if not text.strip():
                    processing_errors.append(f"Could not extract text from {original_filename}")
                    os.remove(filepath)  # Clean up empty file
                    continue

                # Create PDF record in database
                pdf_doc = PDFDocument(
                    session_id=session_id,
                    filename=filename,
                    original_filename=original_filename,
                    file_path=filepath,
                    file_size=file_size
                )
                db.session.add(pdf_doc)
                db.session.flush()  # Get the PDF ID

                # Chunk the text
                chunks = chunk_text(text)
                print(f"[CHUNKING] Created {len(chunks)} chunks for {original_filename}")

                # Process and store chunks with embeddings
                chunk_count = 0
                for i, chunk in enumerate(chunks):
                    try:
                        # Generate embedding
                        embedding = embedding_model.encode([chunk])[0]
                        
                        # Create chunk record
                        pdf_chunk = PDFChunk(
                            pdf_id=pdf_doc.id,
                            chunk_text=chunk,
                            chunk_index=i,
                            chunk_size=len(chunk)
                        )
                        pdf_chunk.set_embedding(embedding)
                        db.session.add(pdf_chunk)
                        chunk_count += 1
                        
                    except Exception as e:
                        print(f"[CHUNK ERROR] Failed to process chunk {i}: {str(e)}")
                        continue

                # Update PDF with chunk count
                pdf_doc.total_chunks = chunk_count
                db.session.commit()

                uploaded_pdfs.append({
                    "id": pdf_doc.id,
                    "filename": original_filename,
                    "text_preview": text[:500] + "..." if len(text) > 500 else text,
                    "chunks_created": chunk_count,
                    "file_size": file_size
                })

            except Exception as e:
                print(f"[PDF PROCESSING ERROR] {original_filename}: {str(e)}")
                processing_errors.append(f"Error processing {original_filename}: {str(e)}")
                continue

        response_data = {
            "success": True,
            "uploaded_pdfs": uploaded_pdfs,
            "total_uploaded": len(uploaded_pdfs)
        }
        
        if processing_errors:
            response_data["warnings"] = processing_errors

        return jsonify(response_data)

    except Exception as e:
        print(f"[UPLOAD ERROR] {str(e)}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route("/get_pdfs/<session_id>", methods=["GET"])
def get_pdfs(session_id):
    """Get all PDFs for a session"""
    try:
        pdfs = get_session_pdfs(session_id)
        return jsonify({
            "success": True,
            "pdfs": [pdf.to_dict() for pdf in pdfs]
        })
    except Exception as e:
        print(f"[GET PDFS ERROR] {str(e)}")
        return jsonify({"error": "Failed to get PDFs"}), 500

@app.route("/remove_pdf/<session_id>/<int:pdf_id>", methods=["DELETE"])
def remove_pdf(session_id, pdf_id):
    """Remove a specific PDF and its chunks"""
    try:
        # Verify PDF belongs to session
        pdf = PDFDocument.query.filter_by(id=pdf_id, session_id=session_id).first()
        if not pdf:
            return jsonify({"error": "PDF not found"}), 404
        
        # Remove file from disk
        try:
            if os.path.exists(pdf.file_path):
                os.remove(pdf.file_path)
        except Exception as e:
            print(f"[FILE DELETE WARNING] Could not delete file {pdf.file_path}: {e}")
        
        # Remove from database
        success = delete_pdf_and_chunks(pdf_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"PDF {pdf.original_filename} removed successfully"
            })
        else:
            return jsonify({"error": "Failed to remove PDF"}), 500
            
    except Exception as e:
        print(f"[REMOVE PDF ERROR] {str(e)}")
        return jsonify({"error": "Failed to remove PDF"}), 500

def retrieve_relevant_chunks(session_id, query, top_k=5):
    """Retrieve most relevant chunks for a query from session's PDFs"""
    try:
        chunks = get_session_chunks(session_id)
        
        if not chunks:
            return [], []
        
        # Get embeddings and chunks
        chunk_embeddings = []
        chunk_data = []
        
        for chunk in chunks:
            try:
                embedding = chunk.get_embedding()
                chunk_embeddings.append(embedding)
                chunk_data.append({
                    'text': chunk.chunk_text,
                    'pdf_id': chunk.pdf_id,
                    'pdf_filename': chunk.pdf_document.original_filename,
                    'chunk_index': chunk.chunk_index
                })
            except Exception as e:
                print(f"[EMBEDDING ERROR] Could not load embedding for chunk {chunk.id}: {e}")
                continue
        
        if not chunk_embeddings:
            return [], []
        
        # Generate query embedding and find similarities
        query_embedding = embedding_model.encode([query])
        similarities = cosine_similarity(query_embedding, chunk_embeddings)[0]
        
        # Get top-k most similar chunks
        top_indices = similarities.argsort()[-top_k:][::-1]
        
        relevant_chunks = []
        relevant_pdf_ids = set()
        
        for idx in top_indices:
            if similarities[idx] > 0.1:  # Minimum similarity threshold
                chunk_info = chunk_data[idx]
                relevant_chunks.append(chunk_info['text'])
                relevant_pdf_ids.add(chunk_info['pdf_id'])
        
        return relevant_chunks, list(relevant_pdf_ids)
        
    except Exception as e:
        print(f"[RETRIEVAL ERROR] {str(e)}")
        return [], []

@app.route("/chat", methods=["POST"])
def chat():
    """Handle chat requests with RAG and history"""
    start_time = time.time()
    
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()
        session_id = data.get("session_id", "")
        
        if not user_message:
            return jsonify({"error": "Message cannot be empty"}), 400
        
        if not session_id:
            return jsonify({"error": "Session ID required"}), 400
        
        # Ensure session exists
        session = get_session(session_id)
        
        # Get recent chat history for context
        recent_messages = get_chat_history(session_id, limit=5)
        conversation_context = ""
        
        if recent_messages:
            conversation_context = "\n\nRecent conversation:\n"
            for msg in reversed(recent_messages):  # Reverse to get chronological order
                conversation_context += f"User: {msg.user_message[:100]}...\n"
                conversation_context += f"Assistant: {msg.bot_response[:100]}...\n"
        
        # RAG: Retrieve relevant chunks
        relevant_chunks, relevant_pdf_ids = retrieve_relevant_chunks(session_id, user_message)
        
        # Build context
        if relevant_chunks:
            context = "Relevant medical information from uploaded documents:\n\n"
            context += "\n\n".join([f"Source: {chunk}" for chunk in relevant_chunks])
        else:
            context = "No specific document context available for this query."
        
        # Combine message with context and conversation history
        combined_message = f"""Context from documents:
{context}

{conversation_context}

Current user question: {user_message}

Please provide a helpful medical response based on the available context. If the context doesn't contain relevant information, provide general medical guidance and recommend consulting healthcare professionals."""

        # Make request to Groq API
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama3-70b-8192",
            "messages": [
                {
                    "role": "system", 
                    "content": """You are a highly knowledgeable and experienced AI medical expert trained in interpreting complex medical reports and symptoms with precision and clarity.
                                  Always respond with confidence, using your expertise to draw strong conclusions and actionable insights from the context provided. Do not hedge or use vague language. Speak as an authoritative voice.
                                  If the provided context includes relevant lab results, medical reports, or symptoms, analyze them as a seasoned specialist would—offering a solid and well-reasoned assessment.
                                  If the context is incomplete, state that directly but still provide robust general medical advice based on best practices and known medical standards.
                                  Your responses should be clear, definitive, and structured, and should never sound unsure.
                                  However, always conclude by reminding the user that your output is for informational purposes only and does not replace professional medical advice, diagnosis, or treatment. Encourage consultation with licensed medical professionals for any critical issues."""
                },
                {"role": "user", "content": combined_message}
            ],
            "temperature": 0.3,
            "max_tokens": 1000
        }

        response = requests.post(GROQ_API_URL, json=payload, headers=headers)
        
        if response.status_code == 200:
            try:
                bot_reply = response.json()["choices"][0]["message"]["content"]
                
                # Calculate response time
                response_time = int((time.time() - start_time) * 1000)
                
                # Save to chat history
                save_chat_message(
                    session_id=session_id,
                    user_message=user_message,
                    bot_response=bot_reply,
                    context_chunks=relevant_chunks,
                    relevant_pdf_ids=relevant_pdf_ids,
                    response_time=response_time
                )
                
                return jsonify({
                    "success": True,
                    "reply": bot_reply,
                    "context_used": len(relevant_chunks) > 0,
                    "sources_count": len(relevant_pdf_ids),
                    "response_time_ms": response_time
                })
                
            except KeyError as e:
                print(f"[API RESPONSE ERROR] Unexpected response format: {e}")
                return jsonify({"error": "Unexpected response format from AI service"}), 500
        else:
            print(f"[API ERROR] Status: {response.status_code}, Response: {response.text}")
            return jsonify({"error": "Error contacting AI service"}), 500

    except Exception as e:
        print(f"[CHAT ERROR] {str(e)}")
        return jsonify({"error": f"Chat failed: {str(e)}"}), 500

@app.route("/get_chat_history/<session_id>", methods=["GET"])
def get_chat_history_endpoint(session_id):
    """Get chat history for a session"""
    try:
        limit = request.args.get('limit', 50, type=int)
        messages = get_chat_history(session_id, limit)
        
        return jsonify({
            "success": True,
            "messages": [msg.to_dict() for msg in reversed(messages)],  # Chronological order
            "total_messages": len(messages)
        })
    except Exception as e:
        print(f"[GET HISTORY ERROR] {str(e)}")
        return jsonify({"error": "Failed to get chat history"}), 500

@app.route("/clear_chat/<session_id>", methods=["DELETE"])
def clear_chat(session_id):
    """Clear all chat history for a session"""
    try:
        clear_session_data(session_id)
        return jsonify({
            "success": True,
            "message": "Chat history and PDFs cleared successfully"
        })
    except Exception as e:
        print(f"[CLEAR CHAT ERROR] {str(e)}")
        return jsonify({"error": "Failed to clear chat"}), 500

@app.route("/session_info/<session_id>", methods=["GET"])
def get_session_info(session_id):
    """Get session information"""
    try:
        session = ChatSession.query.filter_by(session_id=session_id).first()
        if not session:
            return jsonify({"error": "Session not found"}), 404
        
        return jsonify({
            "success": True,
            "session": session.to_dict()
        })
    except Exception as e:
        print(f"[SESSION INFO ERROR] {str(e)}")
        return jsonify({"error": "Failed to get session info"}), 500

if __name__ == "__main__":
    print("🚀 Starting Medical Chatbot Backend...")
    print("📊 Initializing database...")
    
    with app.app_context():
        init_database(app)
        create_indexes()
    
    print("✅ Backend ready!")
    app.run(debug=True, port=5000)

