// In functions/index.js

const {onCall} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Access the API key you stored securely in the environment configuration
const geminiApiKey = process.env.GEMINI_KEY;

// Initialize the Generative AI client with the API key
const genAI = new GoogleGenerativeAI(geminiApiKey);

exports.getOracleJudgement = onCall(
    {
      // We are adding a 'cors' property here
      region: "europe-west4",
      cors: [/nicat\.mteij\.nl$/, /web\.app$/, /firebaseapp\.com$/],
    },
    async (request) => {
      // Log the incoming request data for debugging
      logger.info("Oracle request received", {data: request.data});

      // Get the prompt text and rules from the client
      const {promptText, rules} = request.data;

      if (!promptText) {
        // If no prompt text is provided, throw an error
        throw new onCall.HttpsError(
            "invalid-argument",
            "The function must be called with a 'promptText' argument.",
        );
      }

      try {
        const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});

        // Construct a detailed prompt for the AI
        const rulesText = rules
            .map((rule, index) => `${index + 1}. ${rule.text}`)
            .join("\n");
        const fullPrompt = `
      You are an ancient, wise, and slightly dramatic Oracle for a game
      called "Schikko Rules". Your task is to pass judgement on a
      transgression described by a user.

      Here are the official "Schikko's Decrees":
      ---
      ${rulesText}
      ---

      A user has described the following transgression:
      ---
      "${promptText}"
      ---

      Based on the rules, determine a fitting consequence. Your response
      must be short and in the format: "[Main Judgement]. For example:
      'Noud gets 3 stripes' or 'Noud must roll a die with 3 dotts.'"
      If the described action does not break any rules, you may declare
      the person innocent.
    `;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const judgement = response.text().trim();

        logger.info("Oracle judgement rendered:", {judgement});

        return {judgement};
      } catch (error) {
        logger.error("Error calling Gemini API:", error);
        throw new onCall.HttpsError(
            "internal",
            "The Oracle is silent. An error occurred while seeking judgement.",
        );
      }
    },
);
