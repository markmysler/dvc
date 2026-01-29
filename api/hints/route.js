// Hint API Endpoints
// Handles progressive hint disclosure for challenge sessions

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();

// Import session manager functions (would integrate with existing session system)
// For this implementation, we'll use a simple in-memory store for hint state
const hintSessionStore = new Map();

/**
 * Execute Python hint service function
 * @param {string} functionName - Python function to call
 * @param {object} args - Arguments to pass to the function
 * @returns {Promise<object>} - Result from Python service
 */
function callHintService(functionName, args) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
sys.path.append('${path.join(__dirname, '../..')}')

try:
    from engine.hint_service import ${functionName}

    args = json.loads('${JSON.stringify(args)}')

    if '${functionName}' == 'get_available_hints':
        result = ${functionName}(args['challenge_id'], args['session_data'])
    elif '${functionName}' == 'request_hint':
        result = ${functionName}(args['challenge_id'], args['session_id'])
    elif '${functionName}' == 'get_hint_status':
        result = ${functionName}(args['challenge_id'], args['session_data'])
    else:
        raise ValueError(f"Unknown function: ${functionName}")

    print(json.dumps({"success": True, "data": result}))

except Exception as e:
    print(json.dumps({"success": False, "error": str(e), "type": type(e).__name__}))
`;

    const python = spawn('python3', ['-c', pythonScript]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          resolve(result.data);
        } else {
          const error = new Error(result.error);
          error.pythonType = result.type;
          reject(error);
        }
      } catch (parseError) {
        reject(new Error(`Failed to parse Python output: ${stdout}, stderr: ${stderr}`));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
  });
}

/**
 * Get or initialize session hint data
 * @param {string} sessionId - Session identifier
 * @returns {object} - Session hint data
 */
function getSessionHintData(sessionId) {
  if (!hintSessionStore.has(sessionId)) {
    // Initialize with default hint state
    hintSessionStore.set(sessionId, {
      hints_requested: 0,
      created_at: Date.now() / 1000, // Current timestamp as fallback
      session_id: sessionId
    });
  }
  return hintSessionStore.get(sessionId);
}

/**
 * Update session hint data
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Updates to apply
 */
function updateSessionHintData(sessionId, updates) {
  const current = getSessionHintData(sessionId);
  const updated = { ...current, ...updates };
  hintSessionStore.set(sessionId, updated);
  return updated;
}

/**
 * Validate required query parameters
 * @param {object} query - Express request query object
 * @param {string[]} required - Required parameter names
 * @returns {object|null} - Validation error object or null if valid
 */
function validateRequiredParams(query, required) {
  const missing = required.filter(param => !query[param]);
  if (missing.length > 0) {
    return {
      error: 'Missing required parameters',
      message: `Missing required parameters: ${missing.join(', ')}`,
      missing: missing
    };
  }
  return null;
}

/**
 * GET /api/hints
 * Get available hints for a challenge session
 */
router.get('/', async (req, res) => {
  try {
    // Validate required parameters
    const validation = validateRequiredParams(req.query, ['challenge_id', 'session_id']);
    if (validation) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        ...validation
      });
    }

    const { challenge_id, session_id } = req.query;

    console.log(`Getting hints for challenge: ${challenge_id}, session: ${session_id}`);

    // Get or initialize session hint data
    const sessionHintData = getSessionHintData(session_id);

    try {
      // Call Python hint service
      const hints = await callHintService('get_available_hints', {
        challenge_id: challenge_id,
        session_data: sessionHintData
      });

      // Also get hint status for additional timing information
      const hintStatus = await callHintService('get_hint_status', {
        challenge_id: challenge_id,
        session_data: sessionHintData
      });

      return res.json({
        success: true,
        data: {
          ...hints,
          status: hintStatus
        }
      });

    } catch (error) {
      console.error('Hint service error:', error);

      if (error.pythonType === 'ChallengeNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found',
          message: `Challenge '${challenge_id}' does not exist`,
          challenge_id: challenge_id
        });
      }

      if (error.pythonType === 'InvalidSessionError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid session',
          message: error.message,
          session_id: session_id
        });
      }

      throw error; // Re-throw for general error handler
    }

  } catch (error) {
    console.error('Hint API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while retrieving hints',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/hints
 * Request early hint unlock
 */
router.post('/', async (req, res) => {
  try {
    const { challenge_id, session_id, action } = req.body;

    // Validate required fields
    if (!challenge_id || !session_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'challenge_id and session_id are required',
        required: ['challenge_id', 'session_id']
      });
    }

    if (action !== 'request') {
      return res.status(400).json({
        success: false,
        error: 'Invalid action',
        message: 'Only action "request" is supported',
        received: action
      });
    }

    console.log(`Hint request for challenge: ${challenge_id}, session: ${session_id}`);

    // Get current session hint data
    const sessionHintData = getSessionHintData(session_id);

    // Check current hint state to prevent excessive requests
    try {
      const currentStatus = await callHintService('get_hint_status', {
        challenge_id: challenge_id,
        session_data: sessionHintData
      });

      // Check if user can request more hints
      if (currentStatus.available_count >= currentStatus.total_hints) {
        return res.status(429).json({
          success: false,
          error: 'All hints unlocked',
          message: 'All available hints have already been unlocked',
          total_hints: currentStatus.total_hints,
          available_count: currentStatus.available_count
        });
      }

      // Check rate limiting (max one request per minute)
      const lastRequestTime = sessionHintData.last_hint_request || 0;
      const currentTime = Date.now() / 1000;
      const timeSinceLastRequest = currentTime - lastRequestTime;

      if (timeSinceLastRequest < 60) { // 60 seconds minimum between requests
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: 'Please wait before requesting another hint',
          retry_after_seconds: Math.ceil(60 - timeSinceLastRequest)
        });
      }

    } catch (error) {
      console.error('Error checking hint status:', error);

      if (error.pythonType === 'ChallengeNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found',
          message: `Challenge '${challenge_id}' does not exist`,
          challenge_id: challenge_id
        });
      }

      throw error; // Re-throw for general error handler
    }

    try {
      // Process hint request
      const requestResult = await callHintService('request_hint', {
        challenge_id: challenge_id,
        session_id: session_id
      });

      // Update session hint state
      const updatedSession = updateSessionHintData(session_id, {
        hints_requested: sessionHintData.hints_requested + 1,
        last_hint_request: Date.now() / 1000
      });

      // Get updated hints after request
      const updatedHints = await callHintService('get_available_hints', {
        challenge_id: challenge_id,
        session_data: updatedSession
      });

      const updatedStatus = await callHintService('get_hint_status', {
        challenge_id: challenge_id,
        session_data: updatedSession
      });

      return res.json({
        success: true,
        message: 'Hint unlocked successfully',
        data: {
          ...updatedHints,
          status: updatedStatus,
          request_result: requestResult
        }
      });

    } catch (error) {
      console.error('Hint request error:', error);
      throw error; // Re-throw for general error handler
    }

  } catch (error) {
    console.error('Hint request API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while processing hint request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/hints/status
 * Get hint timing and availability status
 */
router.get('/status', async (req, res) => {
  try {
    const validation = validateRequiredParams(req.query, ['challenge_id', 'session_id']);
    if (validation) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        ...validation
      });
    }

    const { challenge_id, session_id } = req.query;

    console.log(`Getting hint status for challenge: ${challenge_id}, session: ${session_id}`);

    const sessionHintData = getSessionHintData(session_id);

    try {
      const status = await callHintService('get_hint_status', {
        challenge_id: challenge_id,
        session_data: sessionHintData
      });

      return res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Hint status error:', error);

      if (error.pythonType === 'ChallengeNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found',
          message: `Challenge '${challenge_id}' does not exist`,
          challenge_id: challenge_id
        });
      }

      if (error.pythonType === 'InvalidSessionError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid session',
          message: error.message,
          session_id: session_id
        });
      }

      throw error; // Re-throw for general error handler
    }

  } catch (error) {
    console.error('Hint status API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred while retrieving hint status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;