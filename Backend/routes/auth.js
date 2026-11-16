const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { isMailConfigured, sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/') || mime === 'application/octet-stream' || !mime) {
      return cb(null, true);
    }
    return cb(new Error('Only image uploads are allowed'));
  },
});

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

function ensureAvatarDir() {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

function saveAvatarBuffer(file) {
  ensureAvatarDir();
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `avatar_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
  const filepath = path.join(AVATAR_DIR, filename);
  fs.writeFileSync(filepath, file.buffer);
  return `/uploads/avatars/${filename}`;
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    avatar: user.avatar || '',
    emergencyContacts: user.emergencyContacts || [],
  };
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password, avatar } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: 'fullName, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      password,
      avatar: avatar || '',
    });

    const token = signToken(user);

    res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: err.message || 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

const RESET_TOKEN_MS = 60 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  console.log('Forgot password request received');
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isMailConfigured()) {
      console.error(
        'Password reset email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.',
      );
      return res.status(503).json({
        message: 'Password reset email is not configured on the server.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+resetPasswordTokenHash +resetPasswordExpires',
    );

    if (!user) {
      console.log('Forgot password: no matching user');
      return res.json({
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    console.log('User found');
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordTokenHash = hashResetToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_MS);
    await user.save();
    console.log(`Reset token generated length=${rawToken.length}`);

    const base = (process.env.RESET_PASSWORD_URL || 'medigofront://reset-password').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${base}?token=${encodeURIComponent(rawToken)}`;

    console.log('Attempting to send reset email');
    try {
      const info = await sendPasswordResetEmail({ to: user.email, resetUrl });
      const accepted = Array.isArray(info.accepted) ? info.accepted.length : 0;
      console.log(
        `Password reset email sent successfully accepted=${accepted}`,
      );
    } catch (mailErr) {
      console.error(`SMTP error: ${mailErr.message}`);
      return res.status(502).json({
        message: mailErr.message || 'Unable to send reset email.',
      });
    }

    res.json({
      message: 'If that email exists, a reset link has been sent.',
    });
  } catch (err) {
    console.error(`Forgot password failed: ${err.message}`);
    res.status(500).json({ message: err.message || 'Unable to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordTokenHash: hashResetToken(token),
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired' });
    }

    user.password = password;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to reset password' });
  }
});

// GET /api/auth/me — current user from protect middleware
router.get('/me', protect, async (req, res) => {
  try {
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load profile' });
  }
});

// PATCH /api/auth/avatar — upload profile photo
async function handleAvatarUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Avatar image is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.avatar = saveAvatarBuffer(req.file);
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update avatar' });
  }
}

function receiveAvatar(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo' });
    }
    next();
  });
}

router.post('/avatar', protect, receiveAvatar, handleAvatarUpload);
router.patch('/avatar', protect, receiveAvatar, handleAvatarUpload);

// PATCH /api/auth/change-password
router.patch('/change-password', protect, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'currentPassword and newPassword are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to change password' });
  }
});

module.exports = router;
