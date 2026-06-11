import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import OpenAI from 'openai';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.post('/api/analyze', upload.single('resume'), async (req, res) => {
  try {
    const resumeText = await getResumeText(req);
    const role = clean(req.body.role || 'General role');

    if (resumeText.length < 120) {
      return res.status(400).json({ error: 'Please submit a fuller resume with work experience, projects, or skills.' });
    }

    const report = openai ? await analyzeWithLlm(resumeText, role) : fallbackReport(resumeText, role);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Resume analysis failed.' });
  }
});

async function getResumeText(req) {
  const pasted = clean(req.body.resumeText || '');
  if (pasted) return pasted;
  if (!req.file) return '';

  const name = (req.file.originalname || '').toLowerCase();
  const mime = req.file.mimetype || '';

  if (name.endsWith('.pdf') || mime.includes('pdf')) {
    const parsed = await pdfParse(req.file.buffer);
    return clean(parsed.text);
  }

  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
    const parsed = await mammoth.extractRawText({ buffer: req.file.buffer });
    return clean(parsed.value);
  }

  if (name.endsWith('.txt') || mime.includes('text')) {
    return clean(req.file.buffer.toString('utf8'));
  }

  throw new Error('Upload a PDF, DOCX, or TXT resume.');
}

async function analyzeWithLlm(resumeText, role) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a practical resume reviewer for hiring teams. Return only valid JSON.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Analyze the resume for the target role. Extract hiring parameters, score it from 0 to 100, list improvements, and create a gaps checklist.',
          targetRole: role,
          schema: {
            score: 'number',
            verdict: 'string',
            extracted: {
              name: 'string',
              email: 'string',
              phone: 'string',
              location: 'string',
              targetRole: 'string',
              experienceLevel: 'string',
              topSkills: ['string'],
              education: ['string'],
              certifications: ['string'],
              achievements: ['string']
            },
            improvements: ['string'],
            gapsChecklist: [{ item: 'string', status: 'missing | weak | good', advice: 'string' }],
            keywordSuggestions: ['string']
          },
          resume: resumeText.slice(0, 18000)
        })
      }
    ],
    temperature: 0.25
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  return normalizeReport(JSON.parse(raw), 'LLM API');
}

function fallbackReport(text, role) {
  const lower = text.toLowerCase();
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d[\s().-]*){9,}/)?.[0]?.trim() || '';
  const hasNumbers = /\b\d+%|\$\d+|\b\d{2,}\b/.test(text);
  const hasLinks = /linkedin|github|portfolio|https?:\/\//i.test(text);
  const hasProjects = /project|built|developed|implemented|deployed/i.test(text);
  const hasEducation = /education|bachelor|master|university|college|degree/i.test(text);
  const hasExperience = /experience|intern|engineer|developer|manager|analyst|worked/i.test(text);
  const hasSummary = /summary|profile|objective/i.test(text);
  const hasCerts = /certification|certified|certificate/i.test(text);
  const skillBank = ['javascript', 'python', 'react', 'node', 'sql', 'excel', 'aws', 'docker', 'java', 'figma', 'typescript', 'machine learning', 'communication', 'leadership', 'project management'];
  const topSkills = skillBank.filter(skill => hasTerm(lower, skill)).slice(0, 8);
  const score = clamp(38 + topSkills.length * 4 + bool(hasNumbers) * 12 + bool(hasLinks) * 8 + bool(hasProjects) * 10 + bool(hasEducation) * 7 + bool(hasExperience) * 10 + bool(email && phone) * 8 + bool(hasSummary) * 5, 0, 100);

  return normalizeReport({
    score,
    verdict: score >= 78 ? 'Strong resume with a few polish items.' : score >= 60 ? 'Good base, but it needs sharper proof and role alignment.' : 'Needs clearer structure, measurable results, and stronger keyword coverage.',
    extracted: {
      name: firstLikelyName(text),
      email,
      phone,
      location: '',
      targetRole: role,
      experienceLevel: inferLevel(lower),
      topSkills,
      education: hasEducation ? ['Education section found'] : [],
      certifications: hasCerts ? ['Certification reference found'] : [],
      achievements: hasNumbers ? ['Contains measurable results'] : []
    },
    improvements: [
      hasNumbers ? 'Keep the metrics visible and attach them to business or project outcomes.' : 'Add measurable outcomes such as percentages, time saved, revenue, users, grades, or project scale.',
      hasSummary ? 'Tighten the summary around the target role and strongest two skills.' : 'Add a short professional summary tailored to the target role.',
      topSkills.length >= 5 ? 'Group skills by category so recruiters can scan them faster.' : 'Add a focused skills section with tools, languages, platforms, and role-specific keywords.',
      hasProjects ? 'Give each project a problem, action, technology, and result.' : 'Add one or two projects that prove the skills required for the role.'
    ],
    gapsChecklist: [
      { item: 'Contact details', status: email && phone ? 'good' : 'missing', advice: email && phone ? 'Email and phone are visible.' : 'Add a professional email and phone number near the top.' },
      { item: 'Role keywords', status: topSkills.length >= 5 ? 'good' : 'weak', advice: 'Mirror the target job description with honest matching keywords.' },
      { item: 'Measured achievements', status: hasNumbers ? 'good' : 'missing', advice: 'Replace duty-only bullets with results and numbers.' },
      { item: 'Projects or work samples', status: hasProjects ? 'good' : 'weak', advice: 'Show shipped work, tools used, and impact.' },
      { item: 'Links', status: hasLinks ? 'good' : 'missing', advice: 'Add LinkedIn, GitHub, portfolio, or relevant professional links.' }
    ],
    keywordSuggestions: suggestKeywords(role, topSkills)
  }, 'Local backup');
}

function normalizeReport(report, source) {
  return {
    score: clamp(Number(report.score || 0), 0, 100),
    verdict: String(report.verdict || 'Resume analysis completed.'),
    extracted: {
      name: value(report.extracted?.name),
      email: value(report.extracted?.email),
      phone: value(report.extracted?.phone),
      location: value(report.extracted?.location),
      targetRole: value(report.extracted?.targetRole),
      experienceLevel: value(report.extracted?.experienceLevel),
      topSkills: list(report.extracted?.topSkills),
      education: list(report.extracted?.education),
      certifications: list(report.extracted?.certifications),
      achievements: list(report.extracted?.achievements)
    },
    improvements: list(report.improvements).slice(0, 8),
    gapsChecklist: Array.isArray(report.gapsChecklist) ? report.gapsChecklist.slice(0, 8).map(item => ({
      item: value(item.item),
      status: ['missing', 'weak', 'good'].includes(item.status) ? item.status : 'weak',
      advice: value(item.advice)
    })) : [],
    keywordSuggestions: list(report.keywordSuggestions).slice(0, 14),
    source
  };
}

function suggestKeywords(role, existing) {
  const text = role.toLowerCase();
  const map = [
    ['frontend', ['React', 'TypeScript', 'accessibility', 'responsive UI', 'state management']],
    ['backend', ['REST APIs', 'databases', 'authentication', 'performance', 'cloud deployment']],
    ['data', ['SQL', 'Python', 'dashboards', 'statistics', 'data cleaning']],
    ['ai', ['LLM', 'prompting', 'model evaluation', 'embeddings', 'RAG']],
    ['marketing', ['campaigns', 'SEO', 'analytics', 'conversion', 'content strategy']]
  ];
  const base = map.find(([key]) => text.includes(key))?.[1] || ['communication', 'problem solving', 'collaboration', 'ownership', 'delivery'];
  return base.filter(item => !existing.map(skill => skill.toLowerCase()).includes(item.toLowerCase()));
}

function inferLevel(text) {
  if (/\b(senior|lead|principal|manager|head)\b/.test(text)) return 'Senior';
  if (/\b(intern|trainee|student|fresh|entry)\b/.test(text)) return 'Entry level';
  return 'Mid level or not clearly stated';
}

function hasTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

function firstLikelyName(text) {
  return text.split('\n').map(line => line.trim()).find(line => /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}$/.test(line)) || '';
}

function clean(value) {
  return String(value || '').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [];
}

function value(item) {
  return String(item || '').trim();
}

function bool(item) {
  return item ? 1 : 0;
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, Math.round(number)));
}

app.listen(port, () => {
  console.log(`Resume Analyzer running at http://localhost:${port}`);
});
