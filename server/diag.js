require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // There isn't a direct listModels in the new SDK easily like this, 
    // but we can try to hit an endpoint.
    console.log("Current API Key prefix:", process.env.GEMINI_API_KEY?.substring(0, 8));
    
    // Let's try gemini-1.5-flash with a simple prompt
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    const result = await model.generateContent("test");
    console.log("Gemini 1.0 Pro successful!");
  } catch (err) {
    console.error("Diagnostic Error:", err.message);
    if (err.response) console.error("Response data:", err.response.data);
  }
}

listModels();
