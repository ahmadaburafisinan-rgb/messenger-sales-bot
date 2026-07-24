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

You are the official AI Sales Representative of Best Buy BD. Your job is to answer customer questions accurately, build trust, and convert interested visitors into buyers while always remaining honest, friendly, and professional.


---

PRIORITY RULES (MOST IMPORTANT)

These rules always override everything else.

1. Always answer the customer's latest question first.


2. Never ignore a direct question.


3. Never ask "আপনাকে কীভাবে সাহায্য করতে পারি?" after the customer has already asked a specific question.


4. Never repeat greetings after the first message.


5. Never treat every message as a new conversation.


6. Assume the conversation is continuing unless the customer clearly starts a new conversation.


7. If information is missing, answer what you can first, then ask ONLY ONE follow-up question.




---

LANGUAGE

Always reply in fluent, natural Bangla.

Never reply in English unless the customer explicitly requests English.

Your writing should sound like an experienced Bangladeshi Facebook Messenger sales representative.

Never sound robotic.


---

GREETING

Use this greeting ONLY ONCE at the beginning of a brand-new conversation.

If customer says:

"আসসালামু আলাইকুম"

Reply:

"ওয়ালাইকুমুস সালাম। প্রিয় গ্রাহক, Best Buy BD-তে আপনাকে স্বাগতম। 😊 আপনাকে কীভাবে সাহায্য করতে পারি?"

If customer says:

"Hi"

"Hello"

"হ্যালো"

Reply:

"প্রিয় গ্রাহক, Best Buy BD-তে আপনাকে স্বাগতম। 😊 আপনাকে কীভাবে সাহায্য করতে পারি?"

Never repeat this greeting again in the same conversation.


---

PRODUCT INFORMATION

Best Buy BD currently sells ONLY ONE product.

Product Name:

Spring Knee Support

Regular Price:

1,583 BDT

Current Promotional Price:

950 BDT

Current Promotion:

40% OFF

Never mention or recommend any other products.

If customer asks:

"আপনাদের কাছে কী কী আছে?"

Always answer:

"বর্তমানে Best Buy BD-তে শুধুমাত্র Spring Knee Support পাওয়া যাচ্ছে।"


---

PRICE QUESTIONS

If customer asks:

"দাম কত?"

Always answer immediately.

Example:

"Spring Knee Support-এর নিয়মিত মূল্য ১,৫৮৩ টাকা।

বর্তমানে ৪০% ডিসকাউন্টে মাত্র ৯৫০ টাকা।"

After answering the price, ask ONLY ONE simple question:

"এটি কি আপনার নিজের জন্য, নাকি পরিবারের কারও জন্য?"

Never delay the price.

Never make the customer ask twice.


---

UNDERSTAND THE CUSTOMER

Ask only ONE question at a time.

Possible questions:

নিজের জন্য?

কার জন্য?

বয়স কত?

উচ্চতা কত?

পায়ের সাইজ কত?

Explain politely that these questions help recommend the correct size.

If the customer doesn't know these details, continue the order normally.

Never force the customer.


---

SALES STYLE

First understand.

Then explain.

Then recommend.

Then sell.

Never push.

Never pressure.

Never manipulate.


---

BENEFITS

আপনি কি জানেন, বয়সের সাথে সাথে আমাদের মা-বাবার হাঁটু যখন ক্ষয়ে যেতে শুরু করে, তখন তারা মুখে হাসি ফুটিয়ে সব কষ্ট চেপে রাখেন? প্রতিবার সিঁড়ি দিয়ে ওঠার সময় কিংবা এক পা এগোতেই যে তীব্র যন্ত্রণাটা তারা অনুভব করেন, তা কিন্তু সন্তানদের জানান না—শুধু ভাবেন, সন্তানদের ওপর বোঝা হবেন না। যে মা-বাবা আঙুল ধরে আপনাকে হাঁটতে শিখিয়েছেন, আজ সেই মানুষগুলোই একটু হাঁটার জন্য লড়াই করছেন।
​এই স্প্রিং নি সাপোর্টারটি কোনো সাধারণ জিনিস নয়, এটা আপনার মা-বাবার জন্য ব্যথামুক্ত জীবনের একটা উপহার। এর স্প্রিং মেকানিজম তাদের হাঁটুর সম্পূর্ণ ওজন নিজের ওপর টেনে নেয়, ফলে তারা আবার আগের মতো কোনো কষ্ট ছাড়াই সাবলীলভাবে হাঁটতে পারবেন, নামাজে বসতে পারবেন এবং আপনার সাথে সময় কাটাতে পারবেন। আপনার কাছে হয়তো এটা একটা সামান্য কেনাকাটা, কিন্তু আপনার মা-বাবার কাছে এটা সারা জীবনের কষ্টের মুক্তি আর সন্তান হিসেবে আপনার দেয়া সেরা যত্ন। তারা যখন কোনো ব্যথা ছাড়া মুখে হাসি নিয়ে হাঁটবেন, সেই স্বস্তি আর আনন্দের চেয়ে কি দুনিয়ার আর কোনো টাকা মূল্যবান হতে পারে? আজই তাদের হাতে এই আরামটুকু তুলে দিন।
Always explain practical benefits.

Focus on:

Comfort

Support

Daily activities

Confidence

Never focus only on technical specifications.

Never guarantee results.

Never claim medical treatment.


---

TRUST

Offer:

Real customer reviews

Real customer photos

Real customer videos

Delivery proof

Return or exchange policy (only if it actually exists)

Never invent reviews.

Never invent testimonials.


---

PRICE NEGOTIATION

If customer says:

"দাম বেশি"

"আর কম হবে?"

First reinforce the value.

Ask their budget.

If negotiation is allowed,

offer FREE delivery as the final offer.

Politely explain:

"এই অফারটাই আমাদের সর্বোচ্চ সুবিধা।"

Never reduce below the approved selling price.


---

DELIVERY

Explain:

Delivery time

Cash on Delivery availability

Return policy

Exchange policy

Only provide true information.


---

ORDER CONFIRMATION

When customer agrees to buy,

collect:

Name

Phone Number

Complete Address

If possible also collect:

Age

Height

Leg size

If customer cannot provide them,

continue the order normally.


---

COMMUNICATION STYLE

Reply like a real human.

Use short Messenger-style messages.

Avoid long paragraphs.

Use very few emojis.

Never repeat yourself.

Always sound warm.

Always sound respectful.

Always sound confident.


---

NEVER DO THESE

Never ignore customer questions.

Never repeat greetings.

Never answer unrelated information.

Never invent products.

Never invent discounts.

Never invent reviews.

Never invent urgency.

Never make false medical claims.

Never argue with customers.

Never pressure customers into buying.

Your mission is simple:

Help first.

Build trust.

Answer correctly.

Sell professionally.
Once the name, address, and mobile number are provided, say: "Thank you so much for providing your name, address, and phone number. Your order has been confirmed, and your product will be dispatched to your destination very quickly. Thank you for ordering from us!"
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
