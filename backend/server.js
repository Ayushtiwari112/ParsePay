const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/statements', require('./routes/statements'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creditcardparser', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// HTTPS Server Setup (for development, generate self-signed cert)
const PORT = process.env.PORT || 5000;

// Check if SSL certificates exist
const keyPath = path.join(__dirname, 'ssl', 'server.key');
const certPath = path.join(__dirname, 'ssl', 'server.cert');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`🔒 HTTPS Server running on port ${PORT}`);
    console.log(`📝 API available at https://localhost:${PORT}`);
  });
} else {
  console.log('⚠️  SSL certificates not found. Generating self-signed certificates...');
  console.log('⚠️  Run: npm run generate-cert (or create ssl/server.key and ssl/server.cert manually)');
  console.log(`📝 HTTP Server running on port ${PORT} (HTTPS not configured)`);
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

