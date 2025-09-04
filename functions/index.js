// functions/index.js

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {request: gaxiosRequest} = require("gaxios");
const crypto = require("crypto");
const net = require("net");

// Initialize Firebase Admin SDK
initializeApp();
const adminDb = getFirestore();

/**
 * Cloud Function to act as a proxy for fetching iCal data.
 */
exports.getCalendarDataProxy = onRequest(
    {
        region: "europe-west4",
        // Restrict CORS to known frontends (defense-in-depth)
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async (req, res) => {
        // Explicitly deny non-POST and log any attempted PURGE for visibility
        if (req.method === "PURGE") {
            logger.warn(`Denied PURGE request to getCalendarDataProxy from ${req.ip || "unknown-ip"}`);
            res.status(405).send("Method Not Allowed");
            return;
        }
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        // Optional: enforce JSON requests
        if (typeof req.is === "function" && !req.is("application/json")) {
            res.status(415).json({error: {status: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json."}});
            return;
        }

        const url = req?.body?.data?.url;
        if (!url || typeof url !== "string") {
            res.status(400).json({error: {status: "INVALID_ARGUMENT", message: "Missing 'url' argument."}});
            return;
        }

        // Basic SSRF hardening: allow only http(s), disallow localhost/metadata/private IPs and raw IP hosts
        const isPrivateOrDisallowedHost = (hostname) => {
            const lower = String(hostname || "").toLowerCase();

            // Block localhost and link-local/loopback
            if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;

            // Block common metadata/internal hostnames
            if (lower.endsWith(".internal") || lower === "metadata.google.internal") return true;

            // Block private IPv4 ranges and link-local via pattern
            const ipv4Private =
                /^(10\.([0-9]{1,3}\.){2}[0-9]{1,3})$/.test(lower) ||
                /^(192\.168\.[0-9]{1,3}\.[0-9]{1,3})$/.test(lower) ||
                /^(172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3})$/.test(lower) ||
                /^(169\.254\.[0-9]{1,3}\.[0-9]{1,3})$/.test(lower);

            // Block IPv6 unique-local/link-local (fd00::/8, fe80::/10)
            const ipv6Private = lower.startsWith("fd") || lower.startsWith("fe80");

            // If hostname is a literal IP, check class
            const ipVersion = net.isIP(lower);
            if (ipVersion === 4 && ipv4Private) return true;
            if (ipVersion === 6 && (ipv6Private || lower === "::1")) return true;

            // Also block any raw IP literal to be conservative
            if (ipVersion === 4 || ipVersion === 6) return true;

            return false;
        };

        let urlObj;
        try {
            urlObj = new URL(url);
        } catch {
            res.status(400).json({error: {status: "INVALID_ARGUMENT", message: "Invalid URL."}});
            return;
        }

        if (!["http:", "https:"].includes(urlObj.protocol)) {
            res.status(400).json({error: {status: "INVALID_ARGUMENT", message: "Only http(s) URLs are allowed."}});
            return;
        }

        if (isPrivateOrDisallowedHost(urlObj.hostname)) {
            res.status(400).json({error: {status: "INVALID_ARGUMENT", message: "Target host is not allowed."}});
            return;
        }

        try {
            const response = await gaxiosRequest({
                url: urlObj.toString(),
                method: "GET",
                timeout: 8000,
                headers: {
                    "Accept": "text/calendar, text/plain;q=0.9, */*;q=0.1",
                    "User-Agent": "schikko-rules-ical-proxy/1.0"
                },
                // If supported by gaxios, limit payload size (~1MB)
                maxContentLength: 1000000
            });
            const ct = String(response.headers?.["content-type"] || response.headers?.["Content-Type"] || "").toLowerCase();
            if (ct && !(ct.startsWith("text/calendar") || ct.startsWith("text/plain") || ct.startsWith("text/"))) {
                res.status(400).json({error: {status: "INVALID_ARGUMENT", message: "Unsupported content type from target host."}});
                return;
            }
            res.json({data: {icalData: response.data}});
        } catch (error) {
            logger.error("Error fetching iCal data from proxy:", error);
            res.status(500).json({error: {status: "INTERNAL", message: "Could not fetch calendar data."}});
        }
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
      
      const sanitizedPrompt = promptText.replace(/`/g, "'");

      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({model: "gemini-1.5-flash-latest"});
        const rulesText = rules.map((rule, index) => `${index + 1}. ${rule.text}`).join("\n");
        const fullPrompt = `You are an ancient, wise, and slightly dramatic Oracle for a game called "Schikko Rules". Your task is to pass judgement on a transgression described by a user. You must determine the broken rules and their individual penalties. You will output your judgement as a JSON string, wrapped in a markdown code block (e.g., \`\`\`json { ... } \`\`\`). Do NOT output anything else outside the code block.

The JSON must have the following structure:
{
  "person": "string",
  "penalties": [
    {"type": "stripes", "amount": number},
    {"type": "dice", "value": number}
  ],
  "rulesBroken": [number, ...],
  "innocent": boolean
}

IMPORTANT:
- The "penalties" array must contain an object for each individual penalty. Do NOT sum them.
- If multiple dice rolls are required, create a separate "dice" penalty object for each roll. For example, a penalty to roll a d20 and two d6s would result in: "penalties": [{"type": "dice", "value": 20}, {"type": "dice", "value": 6}, {"type": "dice", "value": 6}].
- If no rules are broken, set "innocent" to true and the "penalties" array can be empty.

Here are the official "Schikko's Decrees":
---
${rulesText}
---
A user has described the following transgression:
---
"${sanitizedPrompt}"
---`;
        
        const result = await model.generateContent(fullPrompt);
        const judgementText = result.response.text().trim();
        const jsonMatch = judgementText.match(/```json\n(.*?)```/s);
        const jsonString = (jsonMatch && jsonMatch[1]) ? jsonMatch[1].trim() : judgementText;
        
        const parsedJudgement = JSON.parse(jsonString);

        // For debugging: log the exact object returned by the AI
        logger.info("Parsed judgement from Gemini:", JSON.stringify(parsedJudgement, null, 2));

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

        const password = crypto.randomBytes(4).toString('hex');

        // Store only a salted hash of the password (no plaintext)
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(password, salt, 64).toString('hex');

        await schikkoRef.set({
            email,
            passwordHash: hash,
            passwordSalt: salt,
            createdAt: FieldValue.serverTimestamp()
        });

        // Do NOT log secrets
        logger.info(`Schikko set for ${email}.`);
        
        return {success: true, password: password};
    },
);

/**
 * Logs in the Schikko using a password and issues a short-lived session token.
 */
exports.loginSchikko = onCall(
    {
        region: "europe-west4",
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async (request) => {
        const { password } = request.data;
        if (!password) throw new HttpsError("invalid-argument", "Missing 'password' argument.");
        const now = Date.now();

        // Simple global rate limit: max 20 attempts in a 10-minute window
        const throttleRef = adminDb.collection("config").doc("login_throttle");
        try {
            await adminDb.runTransaction(async (tx) => {
                const snap = await tx.get(throttleRef);
                const data = snap.exists ? snap.data() : {};
                const attempts = Array.isArray(data.attempts) ? data.attempts : [];
                const windowMs = 10 * 60 * 1000;
                const cutoff = now - windowMs;
                const recent = attempts.filter((t) => typeof t === "number" && t > cutoff);
                if (recent.length >= 20) {
                    throw new HttpsError("resource-exhausted", "Too many login attempts. Please try again later.");
                }
                recent.push(now);
                tx.set(throttleRef, { attempts: recent }, { merge: true });
            });
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            logger.warn("Login throttle transaction failed:", e);
        }

        const year = new Date().getFullYear();
        const schikkoRef = adminDb.collection("config").doc(`schikko_${year}`);
        const schikkoDoc = await schikkoRef.get();
        if (!schikkoDoc.exists) throw new HttpsError("not-found", `No Schikko set for ${year}.`);

        const data = schikkoDoc.data();
        let success = false;

        if (data.passwordHash && data.passwordSalt) {
            const computed = crypto.scryptSync(password, data.passwordSalt, 64).toString("hex");
            // timing-safe comparison
            success = crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(data.passwordHash, "hex"));
        } else if (typeof data.password === "string") {
            // Backward compatibility for legacy plaintext storage; migrate on success
            success = data.password === password;
            if (success) {
                const salt = crypto.randomBytes(16).toString("hex");
                const hash = crypto.scryptSync(password, salt, 64).toString("hex");
                await schikkoRef
                    .set({ passwordHash: hash, passwordSalt: salt, password: FieldValue.delete() }, { merge: true })
                    .catch(() => {});
            }
        }

        if (!success) {
            return { success: false };
        }

        // Require an authenticated (anonymous is fine) caller to bind the session.
        const uid = request.auth?.uid;
        if (!uid) {
            throw new HttpsError("unauthenticated", "Must be signed in to start a Schikko session.");
        }

        // Create a short-lived session (12h)
        const sessionId = crypto.randomBytes(16).toString("hex");
        const expiresAtMs = Date.now() + 12 * 60 * 60 * 1000;

        await adminDb
            .collection("config")
            .doc(`schikko_session_${sessionId}`)
            .set({
                uid,
                createdAt: FieldValue.serverTimestamp(),
                expiresAtMs,
            });

        return { success: true, sessionId, expiresAtMs };
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

/**
 * Scheduled function to clean up old activity logs.
 * Runs once a day.
 */
exports.cleanupOldLogs = onSchedule({schedule: "every 24 hours", timeZone: "Europe/Amsterdam"}, async () => {
    logger.info("Running daily cleanup of old activity logs.");

    const activityLogRef = adminDb.collection("activity_log");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query for documents older than 30 days
    const oldLogsQuery = activityLogRef.where("timestamp", "<", thirtyDaysAgo);

    try {
        const snapshot = await oldLogsQuery.get();
        if (snapshot.empty) {
            logger.info("No old logs to delete.");
            return null;
        }

        // Create a batch to delete all old documents
        const batch = adminDb.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        logger.info(`Successfully deleted ${snapshot.size} old log entries.`);
    } catch (error) {
        logger.error("Error cleaning up old logs:", error);
    }

    return null;
});

// Schikko privileged mutations via Admin SDK
exports.schikkoAction = onCall(
    {
        region: "europe-west4",
        cors: ["https://nicat.mteij.nl", "https://schikko-rules.web.app", "https://schikko-rules.firebaseapp.com"],
    },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError("unauthenticated", "Must be signed in.");

        // Require explicit Schikko session ID and validate it against the caller
        const { action, sessionId, ...data } = request.data || {};
        if (!sessionId || typeof sessionId !== "string") {
            throw new HttpsError("unauthenticated", "Schikko session ID is required.");
        }

        const sessionDocRef = adminDb.collection("config").doc(`schikko_session_${sessionId}`);
        const sessionSnap = await sessionDocRef.get();
        const sessionData = sessionSnap.exists ? sessionSnap.data() : null;

        if (
            !sessionData ||
            sessionData.uid !== uid ||
            !(typeof sessionData.expiresAtMs === "number" && sessionData.expiresAtMs > Date.now())
        ) {
            throw new HttpsError("permission-denied", "Schikko session is invalid or has expired.");
        }

        // Rate limit Schikko actions to 10 per minute
        const throttleRef = adminDb.collection("config").doc(`schikko_action_throttle_${uid}`);
        const now = Date.now();
        try {
            await adminDb.runTransaction(async (tx) => {
                const snap = await tx.get(throttleRef);
                const data = snap.exists ? snap.data() : {};
                const attempts = Array.isArray(data.attempts) ? data.attempts : [];
                const windowMs = 60 * 1000;
                const cutoff = now - windowMs;
                const recent = attempts.filter((t) => typeof t === "number" && t > cutoff);
                if (recent.length >= 60) {
                    throw new HttpsError("resource-exhausted", "Too many actions. Please try again later.");
                }
                recent.push(now);
                tx.set(throttleRef, { attempts: recent }, { merge: true });
            });
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            logger.warn("Schikko action throttle transaction failed:", e);
        }

        if (!action || typeof action !== "string") {
            throw new HttpsError("invalid-argument", "Missing or invalid 'action'.");
        }

        try {
            switch (action) {
                // Ledger
                case "addPerson": {
                    const name = String(data.name || "").trim();
                    if (!name) throw new HttpsError("invalid-argument", "Name required.");
                    await adminDb.collection("punishments").add({
                        name,
                        stripes: [],
                        drunkStripes: [],
                        addedBy: uid,
                    });
                    return { ok: true };
                }
                case "addStripe": {
                    const { docId, count = 1 } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    const ts = [];
                    for (let i = 0; i < Math.max(1, Number(count)); i++) {
                        ts.push(new Date(Date.now() + i));
                    }
                    await adminDb.collection("punishments").doc(docId).update({
                        stripes: FieldValue.arrayUnion(...ts),
                    });
                    return { ok: true };
                }
                case "removeLastStripe": {
                    const { docId } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    const ref = adminDb.collection("punishments").doc(docId);
                    const snap = await ref.get();
                    if (!snap.exists) return { ok: true };
                    const person = snap.data() || {};
                    const stripes = Array.isArray(person.stripes) ? person.stripes : [];
                    const drunk = Array.isArray(person.drunkStripes) ? person.drunkStripes : [];
                    if (stripes.length === 0) return { ok: true };

                    // Remove latest normal stripe
                    const sortedStripes = [...stripes].sort((a, b) => a.toMillis() - b.toMillis());
                    const lastStripe = sortedStripes[sortedStripes.length - 1];
                    await ref.update({ stripes: FieldValue.arrayRemove(lastStripe) });

                    // Refresh and possibly remove excess drunk stripes
                    const afterSnap = await ref.get();
                    const after = afterSnap.data() || {};
                    const n = (after.stripes || []).length;
                    const d = (after.drunkStripes || []).length;

                    if (d > n) {
                        const sortedDrunk = [...(after.drunkStripes || [])].sort((a, b) => b.toMillis() - a.toMillis());
                        const toRemove = sortedDrunk.slice(0, d - n);
                        if (toRemove.length) {
                            await ref.update({ drunkStripes: FieldValue.arrayRemove(...toRemove) });
                        }
                    }
                    return { ok: true };
                }
                case "renamePerson": {
                    const { docId, newName } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    const name = String(newName || "").trim();
                    if (!name) throw new HttpsError("invalid-argument", "newName required.");
                    await adminDb.collection("punishments").doc(docId).update({ name });
                    return { ok: true };
                }
                case "deletePerson": {
                    const { docId } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    await adminDb.collection("punishments").doc(docId).delete();
                    return { ok: true };
                }

                // Rules
                case "addRule": {
                    const { text, order } = data;
                    const ruleText = String(text || "").trim();
                    if (!ruleText || typeof order !== "number") {
                        throw new HttpsError("invalid-argument", "text and order required.");
                    }
                    await adminDb.collection("rules").add({
                        text: ruleText,
                        order,
                        tags: [],
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    return { ok: true };
                }
                case "deleteRule": {
                    const { docId } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    await adminDb.collection("rules").doc(docId).delete();
                    return { ok: true };
                }
                case "updateRuleOrder": {
                    const { rule1, rule2 } = data;
                    if (!rule1?.id || !rule2?.id) throw new HttpsError("invalid-argument", "rule1 and rule2 required.");
                    const batch = adminDb.batch();
                    batch.update(adminDb.collection("rules").doc(rule1.id), {
                        order: rule2.order,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    batch.update(adminDb.collection("rules").doc(rule2.id), {
                        order: rule1.order,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    await batch.commit();
                    return { ok: true };
                }
                case "updateRule": {
                    const { docId, text, tags } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    const ruleText = String(text || "").trim();
                    await adminDb.collection("rules").doc(docId).update({
                        text: ruleText,
                        tags: Array.isArray(tags) ? tags : [],
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    return { ok: true };
                }

                // Drunk stripes (Schikko-only revert)
                case "removeLastDrunkStripe": {
                    const { docId } = data;
                    if (!docId) throw new HttpsError("invalid-argument", "docId required.");
                    const ref = adminDb.collection("punishments").doc(docId);
                    const snap = await ref.get();
                    if (!snap.exists) return { ok: true };
                    const person = snap.data() || {};
                    const drunk = Array.isArray(person.drunkStripes) ? person.drunkStripes : [];
                    if (drunk.length === 0) return { ok: true };
                    const sorted = [...drunk].sort((a, b) => b.toMillis() - a.toMillis());
                    await ref.update({ drunkStripes: FieldValue.arrayRemove(sorted[0]) });
                    return { ok: true };
                }

                // Config
                case "saveCalendarUrl": {
                    const { url } = data;
                    if (!url || typeof url !== "string") throw new HttpsError("invalid-argument", "url required.");
                    await adminDb.collection("config").doc("calendar").set({ url }, { merge: true });
                    return { ok: true };
                }
                case "saveNicatDate": {
                    const { dateString } = data;
                    if (!dateString || typeof dateString !== "string") {
                        throw new HttpsError("invalid-argument", "dateString required.");
                    }
                    const date = new Date(dateString);
                    if (Number.isNaN(date.getTime())) {
                        throw new HttpsError("invalid-argument", "Invalid dateString.");
                    }
                    await adminDb.collection("config").doc("nicat").set({ date }, { merge: true });
                    return { ok: true };
                }

                default:
                    throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
            }
        } catch (err) {
            logger.error("schikkoAction failed:", err);
            if (err instanceof HttpsError) throw err;
            throw new HttpsError("internal", "Mutation failed.");
        }
    },
);
