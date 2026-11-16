const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

function toContactDto(contact) {
  const obj = contact.toObject ? contact.toObject() : contact;
  return {
    id: String(obj._id),
    name: obj.name,
    phone: obj.phone,
    relation: obj.relation || undefined,
  };
}

function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

async function sendTwilioSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data.message || data.error_message || `Twilio SMS failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function buildSosMessage({ latitude, longitude, userName }) {
  const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
  const who = userName ? `${userName} ` : '';
  return [
    `EMERGENCY ALERT from MediGo`,
    `${who}needs help.`,
    `Current location: ${mapsLink}`,
    `Coordinates: ${latitude}, ${longitude}`,
  ].join('\n');
}

// GET /api/emergency-contacts
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json((user.emergencyContacts || []).map(toContactDto));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load emergency contacts' });
  }
});

// POST /api/emergency-contacts
router.post('/', protect, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const relation = String(req.body.relation || '').trim();

    if (!name || !phone) {
      return res.status(400).json({ message: 'name and phone are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.emergencyContacts.push({
      name,
      phone,
      relation: relation || undefined,
    });
    await user.save();

    const created = user.emergencyContacts[user.emergencyContacts.length - 1];
    res.status(201).json(toContactDto(created));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to create emergency contact' });
  }
});

// PUT /api/emergency-contacts/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contact = user.emergencyContacts.id(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Emergency contact not found' });
    }

    if (req.body.name !== undefined) {
      contact.name = String(req.body.name).trim();
    }
    if (req.body.phone !== undefined) {
      contact.phone = String(req.body.phone).trim();
    }
    if (req.body.relation !== undefined) {
      contact.relation = String(req.body.relation).trim();
    }

    if (!contact.name || !contact.phone) {
      return res.status(400).json({ message: 'name and phone are required' });
    }

    await user.save();
    res.json(toContactDto(contact));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update emergency contact' });
  }
});

// DELETE /api/emergency-contacts/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contact = user.emergencyContacts.id(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Emergency contact not found' });
    }

    contact.deleteOne();
    await user.save();

    res.json({ message: 'Emergency contact deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to delete emergency contact' });
  }
});

/**
 * POST /api/sos
 * Body: { latitude, longitude, accuracy?, contacts?: [{ id, name, phone }] }
 *
 * Sends SMS via Twilio when TWILIO_* env vars are set.
 * Otherwise returns 503 — does NOT fake a successful send.
 */
router.post('/alert', protect, async (req, res) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        message: 'latitude and longitude are required',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const stored = (user.emergencyContacts || []).map(toContactDto);
    if (stored.length === 0) {
      return res.status(400).json({
        message: 'Add at least one emergency contact before sending an SOS alert.',
      });
    }

    if (!isSmsConfigured()) {
      return res.status(503).json({
        ok: false,
        configured: false,
        message:
          'SOS SMS is not configured on the server. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in the backend environment to enable real SMS delivery.',
        contacts: stored,
        location: { latitude, longitude },
      });
    }

    const message = buildSosMessage({
      latitude,
      longitude,
      userName: user.fullName,
    });

    const results = [];
    for (const contact of stored) {
      try {
        const twilioResult = await sendTwilioSms({
          to: contact.phone,
          body: message,
        });
        results.push({
          contactId: contact.id,
          phone: contact.phone,
          status: 'sent',
          sid: twilioResult.sid,
        });
      } catch (err) {
        results.push({
          contactId: contact.id,
          phone: contact.phone,
          status: 'failed',
          error: err.message,
        });
      }
    }

    const sentCount = results.filter((item) => item.status === 'sent').length;
    if (sentCount === 0) {
      return res.status(502).json({
        ok: false,
        configured: true,
        message: 'SMS provider is configured, but every message failed to send.',
        results,
      });
    }

    res.json({
      ok: true,
      configured: true,
      message: `SOS alert sent to ${sentCount} of ${stored.length} contact(s).`,
      sentCount,
      results,
      location: { latitude, longitude },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to send SOS alert' });
  }
});

module.exports = router;
