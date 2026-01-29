// Challenge Import API Endpoint
// Handles file upload and validation for challenge imports

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { validateImport } = require('../validation/import-handler');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'temp', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/json',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];

  const allowedExtensions = ['.json', '.zip'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only JSON and ZIP files are allowed. Got: ${file.mimetype} with extension ${fileExtension}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Single file only
  }
});

/**
 * POST /api/import
 * Upload and validate challenge file
 */
router.post('/', upload.single('challengeFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please select a challenge file to upload',
        errors: [{
          path: 'file',
          message: 'No file provided',
          suggestion: 'Upload a JSON or ZIP file containing challenge definitions',
          severity: 'error'
        }]
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileExtension = path.extname(fileName).toLowerCase();

    console.log(`Processing uploaded file: ${fileName} (${req.file.size} bytes)`);

    let validationResult;

    try {
      // Validate the uploaded file
      validationResult = await validateImport(filePath, {
        fileName,
        fileType: fileExtension,
        fileSize: req.file.size
      });

      // Clean up the uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error cleaning up uploaded file:', err);
      });

    } catch (error) {
      // Clean up the uploaded file on error
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error cleaning up uploaded file:', err);
      });

      throw error;
    }

    if (validationResult.valid) {
      return res.status(200).json({
        success: true,
        message: `Successfully validated ${validationResult.summary.totalChallenges} challenge(s)`,
        data: {
          fileName,
          validationResult,
          challenges: validationResult.challenges || []
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: `Found ${validationResult.summary.errorCount} error(s) in challenge file`,
        data: {
          fileName,
          validationResult
        }
      });
    }

  } catch (error) {
    console.error('Challenge import error:', error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error cleaning up uploaded file:', err);
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large',
        message: 'File size exceeds 50MB limit',
        errors: [{
          path: 'file',
          message: 'File size exceeds maximum limit of 50MB',
          suggestion: 'Reduce file size or split into multiple smaller files',
          severity: 'error'
        }]
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file',
        message: 'Invalid file format or multiple files uploaded',
        errors: [{
          path: 'file',
          message: 'Only single JSON or ZIP files are supported',
          suggestion: 'Upload one file at a time, either .json or .zip format',
          severity: 'error'
        }]
      });
    }

    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: error.message,
        errors: [{
          path: 'file',
          message: error.message,
          suggestion: 'Upload a .json file with challenge definitions or a .zip file containing Dockerfile and config.json',
          severity: 'error'
        }]
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Import failed',
      message: 'An unexpected error occurred while processing the upload',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errors: [{
        path: 'server',
        message: 'Internal server error during file processing',
        suggestion: 'Please try again or contact support if the issue persists',
        severity: 'error'
      }]
    });
  }
});

/**
 * GET /api/import/formats
 * Returns supported file formats and validation requirements
 */
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    data: {
      supportedFormats: [
        {
          format: 'json',
          description: 'JSON file with challenge definitions',
          mimeTypes: ['application/json', 'text/plain'],
          extensions: ['.json'],
          example: 'challenges.json'
        },
        {
          format: 'zip',
          description: 'ZIP archive containing Dockerfile and config.json',
          mimeTypes: ['application/zip', 'application/x-zip-compressed'],
          extensions: ['.zip'],
          example: 'my-challenge.zip',
          contents: {
            'config.json': 'Challenge metadata and configuration',
            'Dockerfile': 'Container build instructions',
            'src/': 'Challenge source files (optional)'
          }
        }
      ],
      limits: {
        maxFileSize: '50MB',
        maxChallenges: 100,
        supportedContainerImages: ['Official Docker Hub', 'Custom builds via Dockerfile']
      },
      validation: {
        required: ['id', 'name', 'description', 'difficulty', 'category', 'container_spec'],
        security: ['No privileged containers', 'Resource limits enforced', 'Capability restrictions'],
        recommendations: ['Include learning objectives', 'Provide hints for users', 'Test container locally first']
      }
    }
  });
});

module.exports = router;