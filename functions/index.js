// functions/index.js
// In functions/index.js

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Access the API key you stored securely in the environment configuration
const geminiApiKey = process.env.GEMINI_KEY;

// Initialize the Generative AI client with the API key
const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy string matching.
 * @param {string} a The first string.
 * @param {string} b The second string.
 * @return {number} The Levenshtein distance between the two strings.
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment along the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1),
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Cloud Function to get an Oracle's judgement using Google Gemini API.
 * It takes a prompt and existing rules, and returns a generated judgement,
 * with fuzzy matching for names against a provided ledger.
 * @param {object} request The Cloud Function request context.
 * @param {object} request.data The request data sent by the client.
 * @param {string} request.data.promptText The user's transgression description.
 * @param {Array<object>} request.data.rules The list of existing rules.
 * @param {Array<string>} request.data.ledgerNames List of names.
 * @return {object} An object containing the generated judgement string.
 * @throws {HttpsError} If promptText is missing or Gemini API call fails.
 */
exports.getOracleJudgement = onCall(
    {
      region: "europe-west4",
      // ADD YOUR EXACT ORIGINS HERE
      cors: [
        "https://nicat.mteij.nl",
        "https://schikko-rules.web.app",
        "https://schikko-rules.firebaseapp.com",
      ],
      secrets: ["GEMINI_KEY"],
    },
    async (request) => {
      logger.info("Verifying API Key loaded in environment:", geminiApiKey);
      logger.info("Full request data received from client:", request.data);

      const {promptText, rules, ledgerNames} = request.data; // Get ledgerNames

      if (!promptText) {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a 'promptText' argument.",
        );
      }

      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        const rulesText = rules
            .map((rule, index) => `${index + 1}. ${rule.text}`)
            .join("\n");

        const fullPrompt = `
          You are an ancient, wise, and slightly dramatic Oracle for a game
          called "Schikko Rules". Your task is to pass judgement on a
          transgression described by a user.
          You must determine a fitting consequence, strictly based on the
          provided rules. If a rule is broken, you MUST explicitly reference
          it by its number.
          If the transgression involves a person, identify their name from
          the description.
          If you identify a person, use their name directly in the judgement.

          IMPORTANT: If multiple rules are broken, calculate and combine their respective penalties.
          - Add up all the numerical stripe penalties from each broken rule.
          - Include all specified dice rolls from each broken rule, specifying the type of die if mentioned (e.g., "3-sided die", "6-sided die").

          Here are the official "Schikko's Decrees":
          ---
          ${rulesText}
          ---

          A user has described the following transgression:
          ---
          "${promptText}"
          ---

          Based on the rules, determine a fitting consequence. Your response
          must be short and in the format: "[Main Judgement] [Broken Rule(s)]".

          These examples are illustrative of the output format and logic, and do not represent the actual penalties for the specific rules above. They are designed to show how to combine penalties from multiple rules.
          Examples:
          - 'Noud gets 3 stripes [Rule 2]' (for a single rule broken)
          - 'Emma gets 5 stripes and rolls a 4-sided die [Rule 1, Rule 3]' (for multiple rules broken, summing stripes and including a dice roll)
          - 'Liam gets 12 stripes, rolls a 6-sided die, and rolls an 8-sided die [Rule 5, Rule 7, Rule 9]' (for multiple rules broken, summing stripes and including multiple distinct dice rolls)
          - 'Sophie gets 20 stripes and rolls a 10-sided die [Rule 4, Rule 6, Rule 8, Rule 10]' (for several rules broken, summing many stripes and including a specific dice roll)
          - 'The Oracle declares them innocent. No rules broken.' (if no rules are broken)

          Always try to assign a punishment if a rule is clearly broken.
          `; // Reverted to previous natural language prompt

        const result = await model.generateContent(fullPrompt);
        let judgement = result.response.text().trim(); // Get natural language string

        // Apply fuzzy matching to the name in the natural language judgement string
        if (ledgerNames && ledgerNames.length > 0) {
            // Attempt to extract a name from the AI's judgement
            const nameMatch = judgement.match(/^(\w+)(?= gets|\s+must|\s+rolls|\s+roll)|\s(?:gets|rolls|roll|must)\s(\w+)/i);
            let aiSuggestedName = null;
            if (nameMatch) {
                aiSuggestedName = nameMatch[1] || nameMatch[2];
            }
            
            if (aiSuggestedName) {
                let closestName = aiSuggestedName;
                let minDistance = -1;

                ledgerNames.forEach((actualName) => {
                    const distance = levenshteinDistance(aiSuggestedName.toLowerCase(), actualName.toLowerCase());
                    if (minDistance === -1 || distance < minDistance) {
                        minDistance = distance;
                        closestName = actualName;
                    }
                });

                const isNotTooDifferent = minDistance < 3;
                const isNotInnocentJudgement = !judgement.toLowerCase().includes('innocent');

                if (isNotTooDifferent && isNotInnocentJudgement) {
                    const nameRegex = new RegExp(`\\b${aiSuggestedName}\\b`, "gi"); // Define nameRegex for scope.
                    judgement = judgement.replace(nameRegex, closestName);
                }
            }
        }

        logger.info("Oracle judgement rendered:", {judgement});

        return {judgement}; // Return object with 'judgement' string
      } catch (error) {
        logger.error("Error in getOracleJudgement:", error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError(
                "internal",
                "Oracle is silent. An unexpected error occurred.",
            );
        }
      }
    },
);
