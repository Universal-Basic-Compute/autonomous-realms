// This file is no longer needed with Vite and Vercel deployment
// It's kept for reference but will not be used in production
// For local development, use 'npm run dev' which will start Vite's dev server

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the src directory for JavaScript and CSS
app.use('/src', express.static(path.join(__dirname, 'src')));

// Serve node_modules for client-side imports
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// This server is only for legacy development
// Modern development should use Vite: npm run dev
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Legacy client server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log(`For better development experience, use 'npm run dev' instead`);
  });
}

module.exports = app; // Export for testing
