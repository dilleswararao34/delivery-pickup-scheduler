'use strict';

const db = require('../config/db');

// ─── Rental Policy Text (ground truth for the AI) ────────────────────────────
const RENTAL_POLICY_TEXT = `
SD DIGITALS — RENTAL POLICIES & BUSINESS INFORMATION

BUSINESS DETAILS
- Name: SD Digitals
- Location: A-34, Okhla Industrial Area, Phase II, New Delhi, 110020, India
- Email: ops@sddigitals.in
- Phone: +91 11 4059 8899
- Business Hours: Monday–Saturday, 9:00 AM – 7:00 PM IST
- Service Area: Delhi NCR (deliveries across Delhi, Noida, Gurugram, Faridabad, Ghaziabad)

HOW BOOKING WORKS
1. Browse available gear on the public catalog or customer portal.
2. Submit a quotation request (select equipment, dates, delivery address).
3. An SD Digitals operator reviews your request within 1 business day.
4. Once confirmed, a security deposit payment link is sent.
5. After deposit payment, a driver is assigned and the gear is dispatched on the scheduled delivery date.
6. Gear is delivered to your location. You sign off on condition.
7. On the scheduled return date, our driver picks up the equipment.
8. Deposit is refunded within 24–48 hours if returned undamaged.

SECURITY DEPOSITS
- A security deposit of approximately 10% of the equipment's replacement value is held at booking confirmation.
- Deposits are held securely via Razorpay payment gateway.
- Deposits are fully refunded within 24–48 hours after equipment is returned undamaged.
- If damage is found, repair or replacement costs are deducted from the deposit.
- If deposit does not cover the full cost, the client is billed separately.

RENTAL RATES & PAYMENT
- Rental rates are quoted per day (24-hour period from delivery).
- Payment can be made online via Razorpay (cards, UPI, net banking) or Cash on Delivery (COD) for confirmed clients.
- Invoices are issued automatically upon booking confirmation.

CANCELLATION POLICY
- Cancellations more than 24 hours before scheduled delivery: full refund of rental fee and deposit.
- Cancellations within 24 hours of scheduled delivery: subject to review, up to 50% cancellation fee of the daily rental rate.
- To request cancellation, contact ops@sddigitals.in or use the customer portal.

DAMAGED OR LOST EQUIPMENT
- The renter is fully responsible for any damage, loss, or theft during the rental period.
- Damage must be reported immediately by contacting SD Digitals or logging it in the customer portal.
- Damage repair or replacement costs are deducted from the deposit and/or billed separately.

LATE RETURNS
- Late returns are charged at the standard daily rental rate per additional day.
- A surcharge applies if the late return causes a conflict with a subsequent confirmed booking.

VERIFICATION & ELIGIBILITY
- All clients must provide valid identification and company/organization details.
- First-time clients may be subject to additional verification before gear is dispatched.
- SD Digitals reserves the right to decline a booking if verification cannot be completed.

DELIVERY & PICKUP
- Delivery and pickup is handled by SD Digitals logistics personnel.
- Delivery timings are scheduled and confirmed with the client in advance.
- Access to the delivery location must be arranged by the client.

ACCOUNT & PORTAL
- Clients can track their booking status, view invoices, and pay securely through the Customer Portal at /login.
- Profile details (name, phone, company, delivery address) can be updated in the portal under "My Profile".
- For any account issues, contact ops@sddigitals.in.
`;

// ─── Fallback canned answers for common questions ─────────────────────────────
const FALLBACK_RULES = [
  {
    keywords: ['deposit', 'security', 'refund', 'hold'],
    answer: `**Security Deposit Policy**\n\nSD Digitals holds a security deposit of approximately 10% of the equipment's replacement value at booking confirmation. This is processed securely via Razorpay.\n\n✅ Deposits are **fully refunded within 24–48 hours** after equipment is returned undamaged.\n\nIf damage is found, repair costs are deducted from the deposit. For more details, see our [Terms of Service](/terms).`,
  },
  {
    keywords: ['cancel', 'cancellation', 'cancel booking'],
    answer: `**Cancellation Policy**\n\n- **More than 24 hours before delivery**: Full refund of rental fee and deposit.\n- **Within 24 hours of delivery**: Up to 50% cancellation fee of the daily rental rate, subject to admin review.\n\nTo cancel, contact **ops@sddigitals.in** or use your Customer Portal. We're here to help!`,
  },
  {
    keywords: ['damage', 'lost', 'broken', 'theft', 'stolen', 'missing'],
    answer: `**Damaged or Lost Equipment**\n\nIf equipment is damaged or lost during the rental period, please report it immediately:\n\n1. Contact us at **ops@sddigitals.in** or call **+91 11 4059 8899**\n2. Log the damage in the Customer Portal under your booking\n\nRepair or replacement costs will be assessed and deducted from the security deposit. Remaining costs are billed separately.`,
  },
  {
    keywords: ['book', 'booking', 'how to book', 'quote', 'quotation', 'request', 'hire', 'rent'],
    answer: `**How to Book Equipment**\n\n1. **Browse** available gear on the catalog or Customer Portal\n2. **Select** your equipment and submit a Quotation Request with your dates and delivery address\n3. **Review**: Our team confirms availability and sends you a quote within 1 business day\n4. **Confirm**: Pay the security deposit to lock in your booking\n5. **Delivery**: A driver brings your gear on the scheduled date\n6. **Return**: Driver picks up on the return date; deposit refunded within 24–48 hours\n\nSign in at [/login](/login) to get started!`,
  },
  {
    keywords: ['available', 'availability', 'stock', 'in stock', 'free'],
    answer: `**Equipment Availability**\n\nTo check real-time availability, browse the **Catalog** on our homepage or sign into the **Customer Portal** to see which gear is currently available for your dates.\n\nFor specific availability questions, contact us at **ops@sddigitals.in** or **+91 11 4059 8899** and our team will check for you.`,
  },
  {
    keywords: ['price', 'rate', 'cost', 'how much', 'charge', 'fee', 'daily'],
    answer: `**Rental Rates**\n\nRental rates vary by equipment and are quoted **per day**. You can see daily rates for all equipment in the public catalog or Customer Portal.\n\nA security deposit (≈10% of replacement value) is also held at confirmation and refunded after undamaged return.\n\nFor a custom quote for a specific shoot or event, contact **ops@sddigitals.in**.`,
  },
  {
    keywords: ['delivery', 'deliver', 'pickup', 'driver', 'shipping', 'transport', 'location', 'address'],
    answer: `**Delivery & Pickup**\n\nSD Digitals handles all deliveries and pickups in-house across **Delhi NCR** (Delhi, Noida, Gurugram, Faridabad, Ghaziabad).\n\n- Delivery is coordinated to your specified address\n- You'll receive driver details once your booking is confirmed\n- Our depot is at **A-34, Okhla Industrial Area, Phase II, New Delhi 110020**\n\nFor scheduling questions, call **+91 11 4059 8899**.`,
  },
  {
    keywords: ['contact', 'email', 'phone', 'call', 'reach', 'support', 'help', 'team', 'hours', 'open'],
    answer: `**Contact SD Digitals**\n\n📍 A-34, Okhla Industrial Area, Phase II, New Delhi 110020\n📧 **ops@sddigitals.in**\n📞 **+91 11 4059 8899**\n🕒 Monday–Saturday, 9:00 AM – 7:00 PM IST\n\nFor portal or account issues, you can also use the Customer Portal at [/login](/login).`,
  },
  {
    keywords: ['account', 'profile', 'password', 'login', 'sign in', 'portal', 'register'],
    answer: `**Customer Account & Portal**\n\nYou can manage your account at the **Customer Portal** ([/login](/login)):\n\n- View and track your bookings\n- Pay invoices and deposits securely\n- Update your profile, phone, company, and delivery address\n- Download rental invoices as PDF\n\nIf you've forgotten your password, contact **ops@sddigitals.in** and we'll reset it for you.`,
  },
  {
    keywords: ['late', 'overdue', 'extend', 'extension', 'return late'],
    answer: `**Late Returns**\n\nLate returns are charged at the **standard daily rental rate** for each additional day.\n\nA surcharge may apply if the delay conflicts with another confirmed booking.\n\nIf you need to extend your rental period, please contact us **as soon as possible** at **ops@sddigitals.in** or **+91 11 4059 8899** so we can check availability.`,
  },
];

function getFallbackAnswer(userMessage) {
  const lower = userMessage.toLowerCase();
  for (const rule of FALLBACK_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.answer;
    }
  }
  return `Thank you for your message! For the fastest response, please contact our team directly:\n\n📧 **ops@sddigitals.in**\n📞 **+91 11 4059 8899**\n🕒 Mon–Sat, 9 AM – 7 PM IST\n\nAlternatively, sign into the **Customer Portal** at [/login](/login) to manage your bookings and account.`;
}

// ─── Build live equipment snapshot from DB ────────────────────────────────────
async function buildEquipmentContext() {
  try {
    const res = await db.query(`
      SELECT name, category, brand, model_number, status, rental_rate_per_day
      FROM equipment
      ORDER BY category, name
      LIMIT 50
    `);

    if (!res.rows.length) return 'No equipment data available.';

    const lines = res.rows.map((eq) => {
      const statusLabel = eq.status === 'AVAILABLE' ? '✅ Available' : `❌ ${eq.status.replace(/_/g, ' ')}`;
      return `- ${eq.name}${eq.brand ? ` (${eq.brand})` : ''} | ${eq.category} | ₹${parseFloat(eq.rental_rate_per_day).toLocaleString('en-IN')}/day | ${statusLabel}`;
    });

    return `CURRENT EQUIPMENT INVENTORY (live data):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[chat.service] Failed to fetch equipment context:', err.message);
    return 'Equipment inventory data temporarily unavailable.';
  }
}

// ─── Build the full system prompt ─────────────────────────────────────────────
async function buildSystemPrompt(systemPromptOverride) {
  if (systemPromptOverride) return systemPromptOverride;

  const equipmentContext = await buildEquipmentContext();

  return `You are the SD Digitals customer support assistant. SD Digitals is a premium cinema equipment rental company in New Delhi, India.

Your role is to help rental customers with:
- Questions about booking equipment, rental rates, and the booking process
- Policy questions (deposits, cancellations, damage, returns)
- Equipment availability and specifications
- Account and portal assistance
- Contact information and business hours

IMPORTANT RULES:
- Only answer questions relevant to SD Digitals camera/equipment rentals and customer support.
- If someone asks about something completely unrelated (e.g. coding, general knowledge, politics), politely redirect them: "I'm only able to help with SD Digitals rental and equipment questions. For anything else, please contact our team at ops@sddigitals.in."
- Base your answers on the policy information and equipment data below. Do NOT guess or make up prices, policies, or equipment specs not listed here.
- Be concise, professional, and warm. Use markdown formatting (bold, lists) for clarity.
- Always include a helpful next step (link to portal, contact info, etc.).
- If asked about specific equipment availability for specific dates, explain that availability is date-specific and encourage them to submit a quotation request or contact the team directly — you can tell them the current status but not guarantee future availability.

${RENTAL_POLICY_TEXT}

${equipmentContext}`;
}

// ─── Main chat function ───────────────────────────────────────────────────────
/**
 * @param {Array<{role: 'user'|'model', content: string}>} messages - conversation history
 * @param {object} options
 * @param {string} [options.systemPromptOverride] - override for future staff chatbot variant
 * @returns {Promise<{reply: string, source: 'gemini'|'fallback'}>}
 */
async function chat(messages, { systemPromptOverride } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Get the last user message for fallback matching
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  if (!apiKey) {
    console.warn('[chat.service] GEMINI_API_KEY not set — using fallback answers');
    return { reply: getFallbackAnswer(lastUserMsg), source: 'fallback' };
  }

  try {
    const systemPrompt = await buildSystemPrompt(systemPromptOverride);

    // Map our message format to Gemini's content format
    const geminiContents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 600,
        topP: 0.9,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[chat.service] Gemini API error ${response.status}:`, errText.slice(0, 300));
      return { reply: getFallbackAnswer(lastUserMsg), source: 'fallback' };
    }

    const data = await response.json();

    // Extract text from Gemini response structure
    const candidate = data?.candidates?.[0];
    if (!candidate || candidate.finishReason === 'SAFETY') {
      return { reply: getFallbackAnswer(lastUserMsg), source: 'fallback' };
    }

    const replyText = candidate?.content?.parts?.[0]?.text;
    if (!replyText || !replyText.trim()) {
      return { reply: getFallbackAnswer(lastUserMsg), source: 'fallback' };
    }

    return { reply: replyText.trim(), source: 'gemini' };

  } catch (err) {
    console.error('[chat.service] Chat failed, using fallback:', err.message);
    return { reply: getFallbackAnswer(lastUserMsg), source: 'fallback' };
  }
}

module.exports = { chat, getFallbackAnswer };
