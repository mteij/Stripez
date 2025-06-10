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

          Here are the official "Schikko's Decrees":
          ---
          ${rulesText}
          ---

          A user has described the following transgression:
          ---
          "${promptText}"
          ---

          Based on the rules, determine a fitting consequence. Your response
          MUST be a JSON object with the following properties.
          - "type": (string) "addStripes", "rollDice", "addStripesAndRollDice",
            "innocent", or "acknowledge".
            - "addStripes": For assigning stripes.
            - "rollDice": For requiring a dice roll.
            - "addStripesAndRollDice": For both stripes and dice roll.
            - "innocent": If no rules are clearly broken.
            - "acknowledge": If the prompt is unclear, irrelevant, or not a
              transgression.
          - "name": (string, optional) The name of the person, e.g., "Noud".
            Only include if a person is clearly identified.
          - "count": (number, optional) The number of stripes, e.g., 3. Only if
            type involves stripes.
          - "diceValue": (number, optional) Max value of die, e.g., 6. Only if
            type involves dice.
          - "rulesBroken": (array of strings, optional) E.g., ["Rule 2",
            "Rule 3"]. Only include if rules are broken.
          - "displayMessage": (string) A natural language judgment string. This
            message should reflect all actions determined by the 'type' and
            include the 'rulesBroken' in brackets at the end.
          
          Example JSON Output:
          {
            "type": "addStripesAndRollDice",
            "name": "Noud",
            "count": 3,
            "diceValue": 6,
            "rulesBroken": ["Rule 2", "Rule 3"],
            "displayMessage": "Noud gets 3 stripes & rolls 6-sided die [R2,3]."
          }
          If no rules are broken:
          {
            "type": "innocent",
            "displayMessage": "Person is innocent. No rules broken."
          }
          If prompt is unclear:
          {
            "type": "acknowledge",
            "displayMessage": "Oracle acknowledges the message. No specific judgment."
          }

          Ensure the JSON is valid and complete. Only output the JSON object. Do
          NOT include any other text or formatting outside the JSON.
        `;

        const rawResult = await model.generateContent(fullPrompt);
        const rawResponseText = rawResult.response.text().trim();

        // Attempt to parse the AI's output as JSON
        let structuredJudgement;
        try {
            structuredJudgement = JSON.parse(rawResponseText);
        } catch (jsonError) {
            logger.error("AI output was not valid JSON:", rawResponseText,
                jsonError);
            throw new HttpsError(
                "internal",
                "Oracle spoke in riddles, its judgment could not be understood.",
            );
        }
        
        // Ensure structuredJudgement has necessary fields
        if (!structuredJudgement || !structuredJudgement.type ||
            !structuredJudgement.displayMessage) {
            logger.error("AI output JSON missing required fields:",
                structuredJudgement);
            throw new HttpsError(
                "internal",
                "Oracle's judgment format was incomplete.",
            );
        }

        // Apply fuzzy matching to the name in structuredJudgement.name
        if (structuredJudgement.name && ledgerNames && ledgerNames.length > 0) {
          const aiSuggestedName = structuredJudgement.name;
          let closestName = aiSuggestedName;
          let minDistance = -1;

          ledgerNames.forEach((actualName) => {
            const distance = levenshteinDistance(
                aiSuggestedName.toLowerCase(),
                actualName.toLowerCase(),
            );
            if (minDistance === -1 || distance < minDistance) {
              minDistance = distance;
              closestName = actualName;
            }
          });

          const isNotTooDifferent = minDistance < 3;
          // Ensure we don't accidentally replace a name if the AI said "innocent"
          const isNotInnocentJudgement = structuredJudgement.type !== "innocent";

          // Define nameRegex here, outside the inner if, for scope
          const nameRegex = new RegExp(`\\b${aiSuggestedName}\\b`, "gi");

          if (isNotTooDifferent && isNotInnocentJudgement) {
            // Replace the original name with the fuzzy-matched name in the
            // display message and update the name in the structured object itself
            structuredJudgement.displayMessage = 
                structuredJudgement.displayMessage.replace(nameRegex, closestName);
            structuredJudgement.name = closestName; // Update name in structured object
          }
        }

        logger.info("Oracle structured judgement:", structuredJudgement);

        return structuredJudgement; // Return the structured object
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