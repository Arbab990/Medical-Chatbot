# Medical AI Chatbot

A full-stack medical chatbot application with React frontend and Flask backend.

## Features
- 🏥 AI-powered medical Q&A
- 📄 PDF document upload and processing
- 🔍 RAG (Retrieval Augmented Generation)
- 💬 Chat history management
- 🧠 Sentence transformer embeddings

## Tech Stack
- **Frontend**: React.js
- **Backend**: Flask (Python)
- **Database**: SQLAlchemy with SQLite/PostgreSQL
- **AI**: Groq API, Sentence Transformers
- **Deployment**: Vercel + Render / Hugging Face Spaces

## Local Development

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Environment Variables
Create `.env` file in backend folder:
```
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_secret_key
DATABASE_URL=sqlite:///medical_chatbot.db
```

## Deployment
- Frontend: Vercel
- Backend: Render
- Alternative: Hugging Face Spaces

## Disclaimer
This application is for educational purposes only and should not replace professional medical advice.
```

### 4.4 Create .env.example
```bash
# Copy this to .env and fill in your actual values
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///medical_chatbot.db
```

## Step 5: Initialize Git and Push to GitHub

### 5.1 Navigate to Your Project Folder
```bash
cd path/to/your/medical-chatbot
```

### 5.2 Initialize Git Repository
```bash
# Initialize git repository
git init

# Add all files to staging
git add .

# Create first commit
git commit -m "Initial commit: Medical chatbot with React + Flask"
```

### 5.3 Connect to GitHub Repository
```bash
# Add your GitHub repository as remote origin
# Replace YOUR_USERNAME and YOUR_REPO_NAME with actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Verify remote was added
git remote -v
```

### 5.4 Push Code to GitHub
```bash
# Push to GitHub (first time)
git branch -M main
git push -u origin main
