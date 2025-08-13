// api/index.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const { generateTestSummaries } = require("./gemini");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ===== CORS Settings =====
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL || ''
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'CORS policy does not allow access from this origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  optionsSuccessStatus: 200
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// ===== ENV Vars =====
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const owner = process.env.OWNER;
const repo = process.env.REPO;
const branch = process.env.BRANCH;

if (!GITHUB_TOKEN) {
  console.error("No GitHub token found in .env");
}

// ===== ROUTES =====

// Get list of files
app.get('/api/files', async (req, res) => {
  if (!owner || !repo || !branch) {
    return res.status(400).json({ error: "Missing owner, repo, or branch" });
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'my-testcase-gen-app',
        Accept: 'application/vnd.github.v3+json',
      }
    });

    const allFiles = response.data.tree
      .filter(item => item.type === 'blob')
      .map(item => item.path);

    res.json(allFiles);
  } catch (err) {
    console.error("Error fetching files:", err.message);
    res.status(500).json({ error: "Failed to fetch repo files" });
  }
});

// Get file contents
app.post('/api/file-contents', async (req, res) => {
  const { files } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  try {
    const results = [];

    for (const file of files) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`;
      const response = await axios.get(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
      });

      results.push({ file, content: response.data });
    }

    res.json(results);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error fetching file contents' });
  }
});

// Generate summaries
app.post("/api/generate-test-summaries", async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No file contents provided" });
    }

    const summaries = await generateTestSummaries(files);
    res.json({ summaries });
  } catch (err) {
    console.error("Error generating summaries:", err.message);
    res.status(500).json({ error: "Failed to generate summaries" });
  }
});

// Generate test code
app.post("/api/generate-code", async (req, res) => {
  const { summary } = req.body;
  if (!summary) {
    return res.status(400).json({ error: "No summary provided" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a test case code generator.
      Generate a full working test case based on this summary:
      "${summary}"
      Use the appropriate framework (e.g., JUnit for Java, Selenium for Python automation, etc.).
      Provide only the code, no extra explanation.
    `;

    const result = await model.generateContent(prompt);
    const code = result.response.text();

    res.json({ code });
  } catch (err) {
    console.error("Error generating code:", err);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

// ===== Export for Vercel =====
module.exports = app;

