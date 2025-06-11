// functions/index.js
// In functions/index.js

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {request: gaxiosRequest} = require("gaxios"); // Renamed import to avoid conflict

// Access the API key you stored securely in the environment configuration
const geminiApiKey = process.env.GEMINI_KEY;

// Initialize the Generative AI client with the API key
const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * NEW: Cloud Function to act as a proxy for fetching iCal data.
 * This bypasses the browser's CORS restrictions.
 */
exports.getCalendarDataProxy = onCall(
    {
      region: "europe-west4",
      cors: [
        "https://nicat.mteij.nl",
        "https://schikko-rules.web.app",
        "https://schikko-rules.firebaseapp.com",
      ],
    },
    async (request) => {
      const {url} = request.data;
      if (!url) {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a 'url' argument.",
        );
      }

      try {
        const response = await gaxiosRequest({ // Use the renamed import
          url: url,
          method: "GET",
        });
        return {icalData: response.data};
      } catch (error) {
        logger.error("Error fetching iCal data from proxy:", error);
        throw new HttpsError(
            "internal",
            "Could not fetch calendar data.",
            error.message,
        );
      }
    },
);


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
          You must determine the broken rules and their individual penalties.
          You will output your judgement as a JSON string, wrapped in a markdown code block (e.g., \`\`\`json { ... } \`\`\`). Do NOT output anything else outside the code block.

          The JSON must have the following structure:
          {
            "person": "string" (Name of the person, or "Someone" if unclear),
            "penalties": [
              { "type": "stripes", "amount": number },
              { "type": "dice", "value": number },
              // ... more penalties if multiple rules are broken or a rule has multiple penalties
            ],
            "rulesBroken": [number, number, ...], // Array of rule numbers (e.g., [1, 5])
            "innocent": boolean (true if no rules broken, false otherwise)
          }

          Important:
          - For "penalties", list each penalty from each broken rule individually. Do NOT sum stripes or combine dice rolls in the JSON; the client-side will handle that.
          - If a rule specifies "X stripes", add one object: {"type": "stripes", "amount": X}.
          - If a rule specifies "a Y-sided die", add one object: {"type": "dice", "value": Y}.
          - If no rules are broken, set "innocent" to true, and "person", "penalties", "rulesBroken" can be empty or default values.
          - If you identify a person, use their name directly in the "person" field.

          Here are the official "Schikko's Decrees":
          ---
          ${rulesText}
          ---

          A user has described the following transgression:
          ---
          "${promptText}"
          ---

          Illustrative Examples of JSON Output (these do not represent the actual penalties for the specific rules above, but show the desired format):

          Example 1: Single rule broken, only stripes.
          \`\`\`json
          {
            "person": "Noud",
            "penalties": [
              { "type": "stripes", "amount": 3 }
            ],
            "rulesBroken": [2],
            "innocent": false
          }
          \`\`\`

          Example 2: Multiple rules broken, stripes and one die.
          \`\`\`json
          {
            "person": "Emma",
            "penalties": [
              { "type": "stripes", "amount": 5 },
              { "type": "dice", "value": 4 }
            ],
            "rulesBroken": [1, 3],
            "innocent": false
          }
          \`\`\`

          Example 3: Multiple rules broken, stripes and multiple different dice.
          \`\`\`json
          {
            "person": "Liam",
            "penalties": [
              { "type": "stripes", "amount": 10 },
              { "type": "dice", "value": 6 },
              { "type": "dice", "value": 8 }
            ],
            "rulesBroken": [5, 7, 9],
            "innocent": false
          }
          \`\`\`

          Example 4: Many rules broken, summing many stripes, and multiple dice.
          \`\`\`json
          {
            "person": "Sophie",
            "penalties": [
              { "type": "stripes", "amount": 7 },
              { "type": "stripes", "amount": 13 },
              { "type": "dice", "value": 10 },
              { "type": "dice", "value": 20 }
            ],
            "rulesBroken": [4, 6, 8, 10],
            "innocent": false
          }
          \`\`\`

          Example 5: No rules broken.
          \`\`\`json
          {
            "person": "Someone",
            "penalties": [],
            "rulesBroken": [],
            "innocent": true
          }
          \`\`\`
          `;

        const result = await model.generateContent(fullPrompt);
        const judgementText = result.response.text().trim(); // Get natural language string, which should contain JSON now

        logger.info("Raw Oracle judgement text (should contain JSON in markdown block):", {judgementText});

        // Extract JSON string from markdown code block
        const jsonMatch = judgementText.match(/```json\n(.*?)```/s);
        let jsonString = '';
        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1].trim();
        } else {
            // Fallback: If no markdown block, try to parse the whole response as JSON
            // This handles cases where the AI might accidentally omit the markdown block
            jsonString = judgementText;
        }

        let parsedJudgement;
        try {
            parsedJudgement = JSON.parse(jsonString);
        } catch (e) {
            logger.error("Failed to parse AI response as JSON:", e);
            throw new HttpsError(
                "internal",
                "Oracle's response was garbled. Please try again. (Invalid JSON from AI)",
                jsonString, // Include the extracted string for debugging
            );
        }

        // Apply fuzzy matching to the name in the parsed JSON judgement
        if (ledgerNames && ledgerNames.length > 0 && parsedJudgement.person && parsedJudgement.person.toLowerCase() !== 'someone') {
            const aiSuggestedName = parsedJudgement.person;
            let closestName = aiSuggestedName;
            let minDistance = -1;

            ledgerNames.forEach((actualName) => {
                const distance = levenshteinDistance(aiSuggestedName.toLowerCase(), actualName.toLowerCase());
                if (minDistance === -1 || distance < minDistance) {
                    minDistance = distance;
                    closestName = actualName;
                }
            });

            const isNotTooDifferent = minDistance < 3; // Threshold for fuzzy matching
            if (isNotTooDifferent) {
                parsedJudgement.person = closestName;
            }
        }
        
        logger.info("Parsed Oracle judgement:", {parsedJudgement});

        return {judgement: parsedJudgement}; // Return object with parsed JSON judgement
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
