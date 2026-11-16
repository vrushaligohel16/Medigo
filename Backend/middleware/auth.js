const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protects routes by verifying Authorization: Bearer <token>
 * and attaching the full user (minus password) to req.user.
 */
async function protect(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = header.slice('Bearer '.length).trim();

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({ message: 'Server auth is not configured' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    const expired = err && err.name === 'TokenExpiredError';
    console.warn(
      `JWT rejected: ${err && err.name ? err.name : 'Error'} tokenLength=${token.length}`,
    );
    return res.status(401).json({
      message: expired
        ? 'Not authorized, token expired'
        : 'Not authorized, token failed',
    });
  }
}

module.exports = { protect };
