const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

const LLM_API_URL =
  process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

/** Server-side only — never sent to the mobile client */
function getLlmApiKey() {
  return process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '';
}

/**
 * Static drug-interaction reference (used when LLM is unavailable).
 * Keys are sorted lowercase medicine name pairs: "a|b"
 */
const INTERACTION_DATASET = {
  'aspirin|warfarin': {
    severity: 'severe',
    title: 'Increased bleeding risk',
    explanation:
      'Aspirin and warfarin both affect blood clotting. Combining them can raise the risk of serious bleeding. Only use together if a clinician specifically advises it and monitors you.',
  },
  'ibuprofen|warfarin': {
    severity: 'severe',
    title: 'Bleeding risk with NSAID + anticoagulant',
    explanation:
      'Ibuprofen (an NSAID) with warfarin can increase gastrointestinal and other bleeding risk. Prefer alternatives recommended by your clinician.',
  },
  'metformin|alcohol': {
    severity: 'mild',
    title: 'Alcohol may affect metformin',
    explanation:
      'Heavy alcohol use with metformin can increase the risk of lactic acidosis and blood sugar swings. Limit alcohol and discuss safe use with your clinician.',
  },
  'lisinopril|ibuprofen': {
    severity: 'mild',
    title: 'Kidney function caution',
    explanation:
      'ACE inhibitors like lisinopril combined with NSAIDs such as ibuprofen may reduce kidney function, especially if you are dehydrated. Ask your clinician before regular combined use.',
  },
  'atorvastatin|grapefruit': {
    severity: 'mild',
    title: 'Grapefruit may raise statin levels',
    explanation:
      'Grapefruit can increase blood levels of some statins like atorvastatin, raising side-effect risk. Avoid large amounts of grapefruit unless your clinician says otherwise.',
  },
  'amoxicillin|methotrexate': {
    severity: 'mild',
    title: 'Possible methotrexate level increase',
    explanation:
      'Some antibiotics may affect methotrexate clearance. If you take methotrexate, confirm antibiotic choices with your clinician or pharmacist.',
  },
  'paracetamol|alcohol': {
    severity: 'mild',
    title: 'Liver strain with alcohol',
    explanation:
      'Paracetamol (acetaminophen) and heavy alcohol use can stress the liver. Stay within recommended doses and avoid combining with excess alcohol.',
  },
  'acetaminophen|alcohol': {
    severity: 'mild',
    title: 'Liver strain with alcohol',
    explanation:
      'Acetaminophen and heavy alcohol use can stress the liver. Stay within recommended doses and avoid combining with excess alcohol.',
  },
  'sertraline|tramadol': {
    severity: 'severe',
    title: 'Serotonin syndrome risk',
    explanation:
      'SSRIs like sertraline with tramadol can raise serotonin syndrome risk. Seek medical advice before combining and watch for agitation, rapid heart rate, or fever.',
  },
  'metformin|contrast dye': {
    severity: 'mild',
    title: 'Hold metformin around contrast procedures',
    explanation:
      'Metformin is often paused around iodinated contrast imaging to reduce lactic acidosis risk in some patients. Follow your clinician’s pre/post procedure instructions.',
  },
};

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pairKey(a, b) {
  return [normalizeName(a), normalizeName(b)].sort().join('|');
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callLlm(messages, { json = false } = {}) {
  const apiKey = getLlmApiKey();
  if (!apiKey) {
    return null;
  }

  const body = {
    model: LLM_MODEL,
    messages,
    temperature: 0.4,
  };

  if (json) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function fallbackExplanation(medicineName) {
  const name = medicineName || 'This medicine';
  return {
    whatItsFor: `${name} is commonly used as prescribed by your clinician to support treatment when taken on schedule. This is general information, not personalized medical advice.`,
    sideEffects: [
      'Mild nausea or upset stomach',
      'Headache or dizziness',
      'Tiredness in some people',
    ],
    precautions: [
      'Take exactly as prescribed — do not skip or double doses',
      'Tell your doctor about other medicines and supplements you take',
      'Seek urgent care for severe allergic symptoms (swelling, trouble breathing, rash)',
    ],
  };
}

function fallbackChatReply(message) {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('paracetamol') || lower.includes('acetaminophen')) {
    return 'Paracetamol (acetaminophen) is a common pain reliever and fever reducer. Take it as directed and avoid combining with other products that also contain paracetamol. This is general information — not a substitute for medical advice.';
  }

  if (lower.includes('interact')) {
    return 'Drug interactions depend on the exact medicines, doses, and your health conditions. Share the names you take and I can give general cautions, but a pharmacist or doctor should confirm anything important.';
  }

  return `Thanks for your question about “${String(message || '').trim() || 'your health'}”. I’m MediGo’s health assistant — I can share general medicine and wellness information, but I’m not a doctor. For personal medical decisions, please consult your healthcare provider.`;
}

function staticInteractionResults(medicineNames) {
  const names = (medicineNames || [])
    .map((n) => String(n).trim())
    .filter(Boolean);

  const results = [];
  const seen = new Set();

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const key = pairKey(names[i], names[j]);
      if (seen.has(key)) continue;
      seen.add(key);

      const hit = INTERACTION_DATASET[key];
      if (hit) {
        results.push({
          id: `static-${key}`,
          medicines: [names[i], names[j]],
          severity: hit.severity,
          title: hit.title,
          explanation: hit.explanation,
        });
      }
    }
  }

  if (results.length === 0 && names.length >= 2) {
    results.push({
      id: 'none-known',
      medicines: names,
      severity: 'none',
      title: 'No major interactions in reference list',
      explanation:
        'No well-known severe interactions were found in MediGo’s static reference for these names. This does not guarantee safety — confirm with a pharmacist or clinician.',
    });
  }

  return results;
}

async function runInteractionCheck(medicineNames) {
  const names = (medicineNames || [])
    .map((n) => String(n).trim())
    .filter(Boolean);

  if (names.length < 2) {
    return [];
  }

  try {
    const content = await callLlm(
      [
        {
          role: 'system',
          content:
            'You are a cautious clinical pharmacist assistant. Return ONLY JSON: {"interactions":[{"medicines":["A","B"],"severity":"none|mild|severe","title":"...","explanation":"..."}]}. Use plain language. Reminder: not a substitute for professional advice.',
        },
        {
          role: 'user',
          content: `Check potential interactions among these medicines: ${JSON.stringify(names)}`,
        },
      ],
      { json: true },
    );

    if (content) {
      const parsed = extractJson(content);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed?.interactions || parsed?.results || [];

      if (Array.isArray(list) && list.length > 0) {
        return list.map((item, index) => ({
          id: item.id || `llm-${index}`,
          medicines: item.medicines || names,
          severity: ['none', 'mild', 'severe'].includes(item.severity)
            ? item.severity
            : 'mild',
          title: item.title || 'Possible interaction',
          explanation:
            item.explanation ||
            'Review this combination with a clinician or pharmacist.',
        }));
      }
    }
  } catch (err) {
    console.error('Interaction LLM fallback:', err.message);
  }

  return staticInteractionResults(names);
}

// POST /api/ai/explain-medicine
router.post('/explain-medicine', protect, async (req, res) => {
  try {
    const medicineName = (req.body.medicineName || req.body.name || '').trim();
    if (!medicineName) {
      return res.status(400).json({ message: 'medicineName is required' });
    }

    try {
      const content = await callLlm(
        [
          {
            role: 'system',
            content:
              'You explain medicines in plain language for patients. Return ONLY JSON with keys: whatItsFor (string), sideEffects (string[]), precautions (string[]). Keep it general, non-diagnostic, and remind that this is not medical advice.',
          },
          {
            role: 'user',
            content: `Explain the medicine: ${medicineName}`,
          },
        ],
        { json: true },
      );

      if (content) {
        const parsed = extractJson(content);
        if (parsed?.whatItsFor) {
          return res.json({
            whatItsFor: String(parsed.whatItsFor),
            sideEffects: Array.isArray(parsed.sideEffects)
              ? parsed.sideEffects.map(String)
              : fallbackExplanation(medicineName).sideEffects,
            precautions: Array.isArray(parsed.precautions)
              ? parsed.precautions.map(String)
              : fallbackExplanation(medicineName).precautions,
          });
        }
      }
    } catch (err) {
      console.error('Explain-medicine LLM fallback:', err.message);
    }

    res.json(fallbackExplanation(medicineName));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to explain medicine' });
  }
});

// POST /api/ai/chat
router.post('/chat', protect, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const historyMessages = history
      .filter((item) => item && item.content)
      .slice(-12)
      .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content),
      }));

    const last = historyMessages[historyMessages.length - 1];
    const alreadyIncludesMessage =
      last &&
      last.role === 'user' &&
      last.content.trim() === message;

    const llmMessages = [
      {
        role: 'system',
        content:
          'You are MediGo’s AI health assistant. Give helpful, plain-language general health and medicine information. You are not a doctor. Do not diagnose or prescribe. Encourage professional care for urgent or personal medical decisions. Keep answers concise.',
      },
      ...historyMessages,
      ...(alreadyIncludesMessage ? [] : [{ role: 'user', content: message }]),
    ];

    try {
      const content = await callLlm(llmMessages);

      if (content) {
        return res.json({ reply: content });
      }
    } catch (err) {
      console.error('Chat LLM fallback:', err.message);
    }

    res.json({ reply: fallbackChatReply(message) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to chat' });
  }
});

// POST /api/ai/check-interactions
async function handleCheckInteractions(req, res) {
  try {
    const medicines = req.body.medicines || req.body.medicineNames || [];
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ message: 'medicines array is required' });
    }

    const interactions = await runInteractionCheck(medicines);
    res.json({ interactions });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to check interactions' });
  }
}

router.post('/check-interactions', protect, handleCheckInteractions);

module.exports = router;
module.exports.handleCheckInteractions = handleCheckInteractions;
