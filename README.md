# AI Resume Analyzer

An intelligent, web-based Resume Analyzer that parses PDF, DOCX, and TXT resumes and uses AI to extract key hiring parameters, score the resume against a target role, identify critical gaps, and suggest actionable improvements.

The application uses the OpenAI GPT API for in-depth analysis and includes a robust local fallback mechanism so it remains fully functional even without an API key.

---

## 🌟 Features

- **Multi-Format Parsing**: Directly upload resumes in **PDF**, **DOCX (Word)**, or **TXT** formats, or copy-paste text directly.
- **AI-Powered Evaluation**: Analyzes the resume against a specific target role to determine alignment.
- **Detailed Extracted Parameters**: Automatically extracts name, email, phone, location, target role, experience level, top skills, education, certifications, and achievements.
- **Overall Score**: Provides a color-coded visual rating (0–100) based on role matching, keyword density, and formatting.
- **Actionable Improvements**: Suggests specific improvements (e.g., adding metrics, rewriting bullet points).
- **Gaps Checklist**: Identifies missing, weak, or good areas (e.g., contact info, links, metrics, projects) with custom, constructive advice.
- **Keyword Suggestions**: Recommends relevant industry keywords to add to bypass ATS algorithms.
- **Local Fallback Mode**: If no `OPENAI_API_KEY` is provided, the application runs a local analysis using text scanning and regex patterns.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism & Responsive Grid Layout), and ES6+ JavaScript.
- **Backend**: Node.js, Express.js.
- **File Parsing**: 
  - `pdf-parse` for PDF processing.
  - `mammoth` for DOCX (Word Document) processing.
  - `multer` for multi-part file upload management.
- **AI Integration**: OpenAI Node SDK (`gpt-4o-mini`).

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have **Node.js** (v16 or higher) installed on your machine.

### 🔧 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AbdulHadi-81/Resume-Analyzer-Project.git
   cd Resume-Analyzer-Project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to a new `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=your-actual-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   PORT=3000
   ```
   *(Note: The app will run in fallback simulation mode if no API key is specified).*

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open the Application**:
   Navigate to `http://localhost:3000` in your web browser.

---

## 📂 Project Structure

```text
├── public/
│   ├── index.html   # Main workspace layout
│   ├── styles.css   # Modern, responsive UI design system
│   └── app.js       # Form submission handling & dynamic UI rendering
├── .env.example     # Template for environment variables
├── .gitignore       # Git ignore file (safeguards .env and node_modules)
├── package.json     # Node.js project configurations and dependencies
├── server.js        # Express server, file extractors, and LLM orchestration
└── README.md        # Project documentation
```

---

## 🔒 Privacy & Security

- All file processing is performed **in-memory**; uploaded resumes are never saved or persisted on the server storage.
- `.env` containing sensitive API keys is automatically ignored from git commits to prevent accidental credential leakage.
