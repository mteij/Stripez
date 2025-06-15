// functions/index.js

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {request: gaxiosRequest} = require("gaxios");
const cors = require("cors")({origin: true});

// Initialize Firebase Admin SDK
initializeApp();
const adminDb = getFirestore();

/**
 * Cloud Function to act as a proxy for fetching iCal data.
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
 * @param {string} a The first string.
 * @param {string} b The second string.
 * @return {number} The Levenshtein distance.
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
 matrix[i] = [i];
}
  for (let j = 0; j <= a.length; j++) {
 matrix[0][j] = j;
}
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
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
      cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
      secrets: ["GEMINI_KEY"],
    },
    async (request) => {
      const geminiApiKey = process.env.GEMINI_KEY;
      if (!geminiApiKey) {
        throw new HttpsError("internal", "Gemini API Key is not configured.");
      }
      
      const {promptText, rules, ledgerNames} = request.data;
      if (!promptText) {
        throw new HttpsError("invalid-argument", "The function must be called with a 'promptText' argument.");
      }

      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});
        const rulesText = rules.map((rule, index) => `${index + 1}. ${rule.text}`).join("\n");
        const fullPrompt = `You are an ancient, wise, and slightly dramatic Oracle for a game called "Schikko Rules". Your task is to pass judgement on a transgression described by a user. You must determine the broken rules and their individual penalties. You will output your judgement as a JSON string, wrapped in a markdown code block (e.g., \`\`\`json { ... } \`\`\`). Do NOT output anything else outside the code block. The JSON must have the following structure: { "person": "string", "penalties": [ { "type": "stripes", "amount": number }, { "type": "dice", "value": number } ], "rulesBroken": [number, ...], "innocent": boolean }. Important: - For "penalties", list each penalty from each broken rule individually. Do NOT sum them. - If no rules are broken, set "innocent" to true. Here are the official "Schikko's Decrees":\n---\n${rulesText}\n---\nA user has described the following transgression:\n---\n"${promptText}"\n---`;
        
        const result = await model.generateContent(fullPrompt);
        const judgementText = result.response.text().trim();
        const jsonMatch = judgementText.match(/```json\n(.*?)```/s);
        const jsonString = (jsonMatch && jsonMatch[1]) ? jsonMatch[1].trim() : judgementText;
        
        const parsedJudgement = JSON.parse(jsonString);

        if (ledgerNames && ledgerNames.length > 0 && parsedJudgement.person && parsedJudgement.person.toLowerCase() !== 'someone') {
            let closestName = parsedJudgement.person;
            let minDistance = -1;
            ledgerNames.forEach((actualName) => {
                const distance = levenshteinDistance(parsedJudgement.person.toLowerCase(), actualName.toLowerCase());
                if (minDistance === -1 || distance < minDistance) {
                    minDistance = distance;
                    closestName = actualName;
                }
            });
            if (minDistance < 3) parsedJudgement.person = closestName;
        }
        
        return {judgement: parsedJudgement};
      } catch (error) {
        logger.error("Error in getOracleJudgement:", error);
        throw new HttpsError("internal", "The Oracle is silent. An unexpected error occurred.");
      }
    },
);

/**
 * Checks if a Schikko has been set for the current year.
 */
exports.getSchikkoStatus = onCall(
    {
        region: "europe-west4",
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async () => {
        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();
        return {isSet: schikkoDoc.exists};
    },
);

/**
 * Gets information about the current Schikko.
 */
exports.getSchikkoInfo = onCall(
    {
        region: "europe-west4",
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async () => {
        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();
        if (schikkoDoc.exists) {
            const data = schikkoDoc.data();
            const expiry = new Date(year, 11, 31, 23, 59, 59); // End of the year
            return {email: data.email, expires: expiry.toISOString()};
        } else {
            return {email: null, expires: null};
        }
    },
);

/**
 * Sets the Schikko for the current year and returns the password.
 */
exports.setSchikko = onCall(
    {
        region: "europe-west4",
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async (request) => {
        const {email} = request.data;
        if (!email) throw new HttpsError("invalid-argument", "Missing 'email' argument.");

        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();
        if (schikkoDoc.exists) throw new HttpsError("already-exists", `A Schikko is already set for ${year}.`);

        const password = Math.random().toString(36).slice(-8);
        await schikkoRef.set({email, password, createdAt: FieldValue.serverTimestamp()});

        logger.info(`Schikko set for ${email}. Password: ${password}`);
        
        return {success: true, password: password};
    },
);

/**
 * Logs in the Schikko using a password.
 */
exports.loginSchikko = onCall(
    {
        region: "europe-west4",
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async (request) => {
        const {password} = request.data;
        if (!password) throw new HttpsError("invalid-argument", "Missing 'password' argument.");
        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection('config').doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();
        if (!schikkoDoc.exists) throw new HttpsError("not-found", `No Schikko set for ${year}.`);
        return {success: schikkoDoc.data().password === password};
    },
);

/**
 * Scheduled function to reset the Schikko annually.
 */
exports.resetAnnualSchikko = onSchedule({schedule: "0 0 1 1 *", timeZone: "Europe/Amsterdam"}, async () => {
    const previousYear = new Date().getFullYear() - 1;
    const schikkoRef = adminDb.collection('config').doc(`schikko_${previousYear}`);
    logger.info(`Running annual Schikko reset for year ${previousYear}.`);
    await schikkoRef.delete();
    return null;
});
