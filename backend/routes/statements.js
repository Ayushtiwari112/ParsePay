const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Statement = require('../models/Statement');
const { ParsePay } = require('../utils/pdfParser');
const auth = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// @route   POST /api/statements/upload
// @desc    Upload and parse PDF statement
// @access  Private
router.post('/upload', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    // Read file buffer
    const fileBuffer = fs.readFileSync(req.file.path);
    
    // Parse PDF
    const { provider, extractedData, rawText } = await ParsePay(fileBuffer);
    
    // Save to database
    const statement = await Statement.create({
      user: req.user._id,
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      provider,
      extractedData,
      rawText
    });
    
    // Clean up uploaded file (optional - you might want to keep it)
    fs.unlinkSync(req.file.path);
    
    res.status(201).json({
      message: 'PDF parsed successfully',
      statement: {
        id: statement._id,
        provider: statement.provider,
        originalFilename: statement.originalFilename,
        extractedData: statement.extractedData,
        parsedAt: statement.parsedAt
      }
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/statements
// @desc    Get all statements for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const statements = await Statement.find({ user: req.user._id })
      .select('-rawText')
      .sort({ createdAt: -1 });
    
    res.json(statements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/statements/:id
// @desc    Get single statement by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const statement = await Statement.findOne({
      _id: req.params.id,
      user: req.user._id
    }).select('-rawText');
    
    if (!statement) {
      return res.status(404).json({ message: 'Statement not found' });
    }
    
    res.json(statement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/statements/:id/debug
// @desc    Get single statement by ID with rawText for debugging
// @access  Private
router.get('/:id/debug', auth, async (req, res) => {
  try {
    const statement = await Statement.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!statement) {
      return res.status(404).json({ message: 'Statement not found' });
    }
    
    res.json(statement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/statements/:id
// @desc    Delete a statement
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const statement = await Statement.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!statement) {
      return res.status(404).json({ message: 'Statement not found' });
    }
    
    await Statement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Statement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

