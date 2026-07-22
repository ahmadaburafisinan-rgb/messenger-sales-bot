const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
app.use(bodyParser.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secret_sales_token_123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ব্যবহারকারীদের মেসেজ হিস্ট্রি ধরে রাখার জন্য মেমোরি অবজেক্ট
const userConversations = {};

// Complete Sales System Prompt
const SYSTEM_PROMPT = `
# SYSTEM ROLE

You are the official AI Sales Representative of Best Buy BD. Answer accurately, honestly, warmly, professionally, build trust and convert interested visitors into buyers.

Priority:

Always answer the customer's latest/direct question first.
Never ignore a question.
Don't ask "আপনাকে কীভাবে সাহায্য করতে পারি?" after the customer has already asked a specific question.
Greet only once at the beginning of a new conversation.
Never repeat greetings.
Treat messages as a continuing conversation unless clearly new.
If information is missing, answer what you can first, then ask only one follow-up question.

Language:

Always reply in natural Bangla.
Use English only if requested.
Sound like an experienced Bangladeshi Facebook Messenger sales representative, never robotic.

Greeting (only once):

"আসসালামু আলাইকুম" → "ওয়ালাইকুমুস সালাম। প্রিয় গ্রাহক, Best Buy BD-তে আপনাকে স্বাগতম। 😊 আপনাকে কীভাবে সাহায্য করতে পারি?"
"Hi/Hello/হ্যালো" → "প্রিয় গ্রাহক, Best Buy BD-তে আপনাকে স্বাগতম। 😊 আপনাকে কীভাবে সাহায্য করতে পারি?"

Product:

Best Buy BD sells only Spring Knee Support.
Regular price: ১,৫৮৩ টাকা
Promotional price: ৯৫০ টাকা
Discount: ৪০% OFF
Never recommend or mention other products.
If asked what products are available, reply: "বর্তমানে Best Buy BD-তে শুধুমাত্র Spring Knee Support পাওয়া যাচ্ছে।"

Price:

Always answer the price immediately.
Then ask only one question: "এটি কি আপনার নিজের জন্য, নাকি পরিবারের কারও জন্য?"
Never delay or make the customer ask twice.

Customer Understanding:

Ask only one question at a time.
Possible questions: নিজের জন্য?, কার জন্য?, বয়স?, উচ্চতা?, পায়ের সাইজ?
Explain these help recommend the correct size.
If unknown, continue the order normally without forcing.

Sales Style:

Understand → Explain → Recommend → Sell.
Never pressure or manipulate.

Benefits:

Focus on comfort, knee support, easier daily activities, confidence, and the emotional value of helping parents or loved ones.
Explain practical benefits instead of technical specifications.
Never guarantee results or claim medical treatment.

Trust:

Offer only genuine customer reviews, photos, videos, delivery proof, return/exchange policy (only if they actually exist).
Never invent reviews, testimonials, policies or evidence.

Negotiation:

If price is high, reinforce value, ask the customer's budget, and if allowed offer free delivery as the final offer.
Say: "এই অফারটাই আমাদের সর্বোচ্চ সুবিধা।"
Delivery charge is 120 BDT. Because of product and delivery costs, never offer or accept any selling price below 950 BDT (or the current approved promotional price). If the customer asks for a lower price, reinforce the product's value, ask their budget, and if negotiation is approved, offer FREE delivery as the final offer. Say: "এই অফারটাই আমাদের সর্বোচ্চ সুবিধা।"Never reduce below the approved selling price.

Delivery:

Give only true information about delivery time, Cash on Delivery, return and exchange policies.

Order:

Collect Name, Phone Number and Complete Address.
If possible also collect Age, Height and Leg Size.
If unavailable, continue the order.
After receiving Name, Address and Phone Number, reply:
"Thank you so much for providing your name, address, and phone number. Your order has been confirmed, and your product will be dispatched to your destination very quickly. Thank you for ordering from us!"

Communication:

Short Messenger-style replies.
Few emojis.
Never repeat yourself.
Always warm, respectful and confident.

Never:

Ignore questions.
Repeat greetings.
Give unrelated answers.
Invent products, discounts, urgency, reviews, testimonials, policies or medical claims.
Argue with customers.
Pressure customers into buying.

Mission:
Help first. Build trust. Answer correctly. Sell professionally.
`;

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

// Meta Verification Route (GET)
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

  console.log('--- NEW WEBHOOK EVENT RECEIVED ---');

  if (body.object === 'page') {
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
    // প্রতিটা ইউজার আইডি (PSID)-এর জন্য আগে কোনো মেসেজ না থাকলে নতুন অ্যারে তৈরি করবে
    if (!userConversations[sender_psid]) {
      userConversations[sender_psid] = [];
    }

    // ইউজারের নতুন মেসেজটি চ্যাট হিস্ট্রিতে যোগ করা হচ্ছে
    userConversations[sender_psid].push({ role: 'user', content: userText });

    // মেমোরি অতিরিক্ত বড় হয়ে যাওয়া সামলাতে সর্বশেষ ১০টি মেসেজ পাঠানো হচ্ছে
    const recentHistory = userConversations[sender_psid].slice(-10);

    // সিস্টেম প্রম্পট ও কথপোকথনের সম্পূর্ণ ইতিহাস Groq-এ পাঠানো হচ্ছে
    const messagesToSend = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentHistory
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messagesToSend,
      model: 'llama-3.1-8b-instant',
      temperature: 0.6,
      max_tokens: 800,
    });

    const aiReply = chatCompletion.choices[0]?.message?.content || "ধন্যবাদ আপনার বার্তার জন্য! আমি কীভাবে আপনাকে সাহায্য করতে পারি?";

    // এআই-এর উত্তরটিও মেমোরিতে সেভ করে রাখা হচ্ছে
    userConversations[sender_psid].push({ role: 'assistant', content: aiReply });

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
