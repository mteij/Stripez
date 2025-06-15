// functions/index.js

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {request: gaxiosRequest} = require("gaxios");
const cors = require("cors")({origin: true});
const nodemailer = require("nodemailer");

// Initialize Firebase Admin SDK
initializeApp();
const adminDb = getFirestore();

/**
 * REWRITTEN: Cloud Function to act as a proxy for fetching iCal data.
 */
exports.getCalendarDataProxy = onRequest(
    {region: "europe-west4"},
    (req, res) => {
      cors(req, res, async () => {
        if (req.method !== "POST") {
          res.status(405).send("Method Not Allowed");
          return;
        }
        const url = req.body.data.url;
        if (!url) {
          res.status(400).json({error: {status: "INVALID_ARGUMENT", message: "Missing 'url' argument."}});
          return;
        }
        try {
          const response = await gaxiosRequest({url, method: "GET"});
          res.json({data: {icalData: response.data}});
        } catch (error) {
          logger.error("Error fetching iCal data from proxy:", error);
          res.status(500).json({error: {status: "INTERNAL", message: "Could not fetch calendar data."}});
        }
      });
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
 */
exports.getOracleJudgement = onCall(
    {
      region: "europe-west4",
      cors: [
        "https://nicat.mteij.nl",
        "https://schikko-rules.web.app",
        "https://schikko-rules.firebaseapp.com",
      ],
      secrets: ["GEMINI_KEY"],
    },
    async (request) => {
      const geminiApiKey = process.env.GEMINI_KEY;
      logger.info("Verifying API Key loaded in environment:", !!geminiApiKey);
      logger.info("Full request data received from client:", request.data);

      const {promptText, rules, ledgerNames} = request.data;

      if (!promptText) {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a 'promptText' argument.",
        );
      }

      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
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
              { "type": "dice", "value": number }
            ],
            "rulesBroken": [number, number, ...],
            "innocent": boolean
          }

          Important:
          - For "penalties", list each penalty from each broken rule individually. Do NOT sum them.
          - If no rules are broken, set "innocent" to true.

          Here are the official "Schikko's Decrees":
          ---
          ${rulesText}
          ---

          A user has described the following transgression:
          ---
          "${promptText}"
          ---
          `;

        const result = await model.generateContent(fullPrompt);
        const judgementText = result.response.text().trim();

        logger.info("Raw Oracle judgement text:", {judgementText});

        const jsonMatch = judgementText.match(/```json\n(.*?)```/s);
        let jsonString = '';
        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1].trim();
        } else {
            jsonString = judgementText;
        }

        let parsedJudgement;
        try {
            parsedJudgement = JSON.parse(jsonString);
        } catch (e) {
            logger.error("Failed to parse AI response as JSON:", e);
            throw new HttpsError("internal", "Oracle's response was garbled.", jsonString);
        }

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

            if (minDistance < 3) {
                parsedJudgement.person = closestName;
            }
        }
        
        logger.info("Parsed Oracle judgement:", {parsedJudgement});

        return {judgement: parsedJudgement};
      } catch (error) {
        logger.error("Error in getOracleJudgement:", error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "Oracle is silent. An unexpected error occurred.");
        }
      }
    },
);

/**
 * Checks if a Schikko has been set for the current year.
 */
exports.getSchikkoStatus = onCall(
    {region: "europe-west4", cors: ["https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"]},
    async (request) => {
        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();
        
        return {isSet: schikkoDoc.exists};
    },
);

/**
 * Sets the Schikko for the current year, generates a password, and sends it via email.
 */
exports.setSchikko = onCall(
    {
      region: "europe-west4",
      secrets: ["MAIL_USER", "MAIL_PASS"], // Make credentials available
      cors: ["https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async (request) => {
        const {email} = request.data;
        if (!email) {
            throw new HttpsError("invalid-argument", "The function must be called with an 'email' argument.");
        }

        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();

        if (schikkoDoc.exists) {
            throw new HttpsError("already-exists", `A Schikko has already been set for ${year}.`);
        }

        const password = Math.random().toString(36).slice(-8);

        // WARNING: Storing plain text passwords is NOT secure.
        await schikkoRef.set({
            email,
            password, // In a production app, this should be a HASH of the password.
            createdAt: FieldValue.serverTimestamp(),
        });
        
        const transporter = nodemailer.createTransport({
            host: "smtp.purelymail.com",
            port: 465,
            secure: true, // Use SSL
            auth: {
                user: process.env.MAIL_USER, // Your Purelymail full email address
                pass: process.env.MAIL_PASS, // Your Purelymail App Password
            },
        });

        const mailOptions = {
            from: `"The Schikko Scribe" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Your Sacred Password as Schikko for ${year}`,
            html: `
                <p>Hark, claimant!</p>
                <p>You have been chosen as the Schikko for the year ${year}.</p>
                <p>Guard the following password with your life, for it grants the power to shape the Decrees:</p>
                <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px; background: #f5eeda; padding: 10px; border: 1px solid #b9987e;">
                    ${password}
                </p>
                <p>May your reign be just.</p>
            `,
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`Schikko password successfully sent to ${email}.`);
            return {success: true};
        } catch (error) {
            logger.error(`Failed to send Schikko password to ${email}:`, error);
            throw new HttpsError("internal", "The Schikko has been set, but the raven failed to deliver the password. Please check the function logs.");
        }
    },
);

/**
 * Logs in the Schikko using a password.
 */
exports.loginSchikko = onCall(
    {region: "europe-west4", cors: ["https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"]},
    async (request) => {
        const {password} = request.data;
        if (!password) {
            throw new HttpsError("invalid-argument", "The function must be called with a 'password' argument.");
        }

        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();

        if (!schikkoDoc.exists) {
            throw new HttpsError("not-found", `No Schikko has been set for ${year}.`);
        }

        const schikkoData = schikkoDoc.data();
        
        if (schikkoData.password === password) {
            return {success: true};
        } else {
            return {success: false};
        }
    },
);

/**
 * Scheduled function to reset the Schikko at the end of the year.
 * Runs on the 1st of January at 00:00 Europe/Amsterdam time.
 */
exports.resetAnnualSchikko = onSchedule({schedule: "0 0 1 1 *", timeZone: "Europe/Amsterdam"}, async (event) => {
    const previousYear = new Date().getFullYear() - 1;
    const schikkoRef = adminDb.collection('config').doc(`schikko_${previousYear}`);
    
    logger.info(`Running annual Schikko reset for year ${previousYear}.`);
    
    const schikkoDoc = await schikkoRef.get();
    if (schikkoDoc.exists) {
        await schikkoRef.delete();
        logger.info(`Successfully deleted Schikko for year ${previousYear}.`);
    } else {
        logger.info(`No Schikko found for year ${previousYear}, no action taken.`);
    }
    
    return null;
});
