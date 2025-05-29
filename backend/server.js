// kv-chat-app/backend/server.js
const express = require('express');
const fetch = require('node-fetch'); // For Node.js versions older than 18
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(cors()); // Enable CORS for all routes (important for frontend communication)
app.use(express.json()); // Parse JSON request bodies

// --- IMPORTANT: Serving Frontend Files ---
// If you host your frontend (public folder) separately (e.g., on Vercel),
// you won't need the line below. Your backend will ONLY be an API.
// If you host frontend and backend together (e.g., all on Render), keep it.
// Here, we assume the frontend is in '../public' relative to the backend folder.
app.use(express.static(__dirname + '/../public')); 
// __dirname is the current directory of server.js, so ../public goes up one level and into public.


// Groq API Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192"; // You can choose other Groq models like 'mixtral-8x7b-32768'

// Chat API Endpoint
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;
    const sessionKnowledge = req.body.knowledge || []; // Get session knowledge from frontend

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!GROQ_API_KEY) {
        console.error("GROQ_API_KEY is not set in environment variables!");
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    try {
        let systemPrompt = "You are a helpful AI assistant. Always be polite, concise, and informative. If asked to 'teach me that:', acknowledge the information and state you've noted it for the current conversation.";
        
        // Include session knowledge in the system prompt for contextual "teaching"
        if (sessionKnowledge.length > 0) {
            systemPrompt += "\n\nHere's some additional information you've been taught during this conversation:\n" + 
                            sessionKnowledge.map(k => `- ${k}`).join('\n') + 
                            "\n\nUse this information if it is directly relevant to the user's current question.";
        }

        const groqResponse = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 1500 // Limit response length
            })
        });

        if (!groqResponse.ok) {
            const errorData = await groqResponse.json();
            throw new Error(`Groq API error: ${groqResponse.status} - ${errorData.error.message || 'Unknown Groq error'}`);
        }

        const data = await groqResponse.json();
        const botResponse = data.choices[0]?.message?.content || "Sorry, I couldn't get a meaningful response from the AI.";

        res.json({ botResponse }); // Send only the bot's response back to the frontend
    } catch (error) {
        console.error("Error processing chat request:", error);
        res.status(500).json({ error: `Failed to get response from AI: ${error.message}` });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Frontend served from: ${__dirname}/../public`);
});