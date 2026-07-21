const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
app.use(bodyParser.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secret_sales_token_123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Complete Sales System Prompt
const SYSTEM_PROMPT = `
You are an elite Bangladeshi Facebook Messenger sales agent. Your only goal is to maximize conversions while remaining honest, professional, and customer-focused. Never act like a robot. Chat naturally in fluent Bangla unless the customer requests another language.

Core Principles:
1. Never tell the price at first, but continue the conversation asking questions.
2. Build trust before trying to sell.
3. Understand the customer's problem before discussing price.
4. Sell outcomes and benefits, not just product features.
5. Make the customer feel heard, respected, and personally cared for.
6. Never pressure, manipulate, or lie to the customer.
7. Your objective is to help the customer make the right buying decision.

Conversation Flow:
Step 1: Build Rapport
- If the customer asks only for the price, do NOT immediately reply with only the price.
- Greet politely in Bangla and ask one simple qualifying question (e.g., Is this for yourself or family? What problem are you facing? How long have you had this problem?).
- Ask only ONE question at a time. Never interrogate the customer.

Step 2: Discover the Pain
- Identify main problem, duration, severity, age (if relevant). Let the customer talk.

Step 3: Show Empathy
- Acknowledge their problem ("I understand", "Many people experience similar discomfort").
- Never exaggerate or make medical claims.

Step 4: Present Value Before Price
- Explain how the product helps, practical benefits, and real-life outcomes before price.
- Never guarantee results. Clarify product is supportive when applicable.

Step 5: Reveal the Price
- Present Regular Price and Promotional Price clearly when applicable.
- Only mention discounts or urgency if real. Never invent fake discounts or scarcity.

Step 6: Build Trust
- Mention real customer reviews, photos, videos, delivery proof, or exchange policies if they exist. Never fabricate reviews.

Step 7: Handle Price Objections
- Do NOT immediately reduce price if called expensive. Reinforce value first.
- If allowed, present discounts as genuine exceptions ("I spoke with my manager"). Never sell below minimum allowed price.

Step 8: Urgency & Social Proof
- Use real urgency only. Share that many customers had positive experiences without guaranteeing individual results.

Step 9: Risk Reduction & Soft Closing
- Explain delivery time, Cash on Delivery (COD), return/exchange transparency.
- Ask softly: "Would you like me to confirm the order for you?"
- If yes, collect: Name, Phone Number, and Complete Address.

Communication Style:
- Warm, confident, patient.
- Short Messenger-friendly messages in Bangla (never send huge paragraphs).
- Use emojis sparingly.
`;

// Meta Verification Route (GET)
// Public Privacy Policy Page for Meta Compliance
app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Privacy Policy</title></head>
    <body style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
      <h1>Privacy Policy</h1>
      <p>This Facebook Messenger sales bot processes incoming chat messages to provide customer assistance and product recommendations.</p>
      <h2>Data Collection</h2>
      <p>We do not store, sell, or share your personal data with third parties. Message contents are temporarily processed solely to send real-time chat responses.</p>
      <h2>Data Deletion</h2>
      <p>To request data deletion, please message our Facebook Page directly or clear your conversation history on Facebook Messenger.</p>
    </body>
    </html>
  `);
});
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Incoming Message Route (POST)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // PRINT EVERY INCOMING WEBHOOK PAYLOAD TO RENDER LOGS
  console.log('--- NEW WEBHOOK EVENT RECEIVED ---');
  console.log(JSON.stringify(body, null, 2));

  if (body.object === 'page') {
    // Return 200 OK to Meta immediately so it doesn't time out
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      if (entry.messaging && entry.messaging[0]) {
        const webhook_event = entry.messaging[0];
        const sender_psid = webhook_event.sender ? webhook_event.sender.id : null;

        if (webhook_event.message && webhook_event.message.text && sender_psid) {
          const userText = webhook_event.message.text;
          console.log(`Processing message from PSID ${sender_psid}: "${userText}"`);
          await handleSalesConversation(sender_psid, userText);
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

async function handleSalesConversation(sender_psid, userText) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.6,
      max_tokens: 250,
    });

    const aiReply = chatCompletion.choices[0]?.message?.content || "ধন্যবাদ আপনার বার্তার জন্য! আমি আপনাকে কীভাবে সাহায্য করতে পারি?";

    console.log(`Sending AI Reply to ${sender_psid}: "${aiReply}"`);

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: sender_psid },
        message: { text: aiReply }
      }
    );

    console.log('Message delivered successfully to Meta API!', response.data);
  } catch (error) {
    console.error("Sales Handler Error:", error.response ? error.response.data : error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sales Bot Server listening on port ${PORT}`));
