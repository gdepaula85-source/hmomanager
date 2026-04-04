require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Configuration injection for the frontend
app.get('/config.js', (req, res) => {
  res.type('.js');
  res.send(`
    window.ENV = {
      SUPA_URL: "${process.env.SUPABASE_URL || ''}",
      SUPA_KEY: "${process.env.SUPABASE_ANON_KEY || ''}"
    };
  `);
});

// Example API Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Backend is running correctly.' });
});

// Fallback to index.html for any frontend routes that are not API routes
// This handles client-side routing if you decide to implement it in the frontend later
app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
