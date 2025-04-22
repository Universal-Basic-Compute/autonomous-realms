const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the src directory for JavaScript and CSS
app.use('/src', express.static(path.join(__dirname, 'src')));

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Client server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
