import { Hono } from "hono";
import { streamText } from "hono/streaming";
import OpenAI from "openai";
import { OPENAI_API_KEY, OPENAI_BASE_URL, ORACLE_MODEL } from "../config";
import { getCookie } from "../utils/helpers";
import { pushThrottle } from "../utils/throttle";

const app = new Hono();

// Oracle rate limiting: permissive until misuse (30/hour per uid, 5/min burst cap)
async function checkOracleRateLimit(uid: string): Promise<{ allowed: boolean; reason?: string }> {
  const burstOk = await pushThrottle(`oracle_burst_${uid}`, 5, 60 * 1000);
  if (!burstOk) return { allowed: false, reason: "too-fast" };
  const hourlyOk = await pushThrottle(`oracle_hourly_${uid}`, 30, 60 * 60 * 1000);
  if (!hourlyOk) return { allowed: false, reason: "hourly-limit" };
  return { allowed: true };
}

app.post("/judgement", async (c) => {
  const { promptText, rules, ledgerNames, consecutiveBreaks } = await c.req.json();
  if (!OPENAI_API_KEY) return c.json({ error: "OPENAI_API_KEY not configured" }, 500);
  if (!promptText) return c.json({ error: "invalid-argument" }, 400);

  const uid = getCookie(c, "uid") || c.req.header("x-forwarded-for") || "anon";
  const rateCheck = await checkOracleRateLimit(uid);
  if (!rateCheck.allowed) {
    const msg = rateCheck.reason === "too-fast"
      ? "The Oracle demands a moment of silence between each petition."
      : "The Oracle has grown weary of your endless petitions. Return in an hour.";
    return c.json({ error: "resource-exhausted", message: msg }, 429);
  }

  const sanitizedPrompt = String(promptText).replace(/`/g, "'");

  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: OPENAI_BASE_URL,
  });

  const rulesText = (Array.isArray(rules) ? rules : [])
    .map((rule: any, i: number) => `${i + 1}. ${rule.text}`)
    .join("\n");

  // Format known names for context
  const knownNames = Array.isArray(ledgerNames) && ledgerNames.length > 0
    ? ledgerNames.join(", ")
    : "None known";

  // Format consecutive breaks information
  let consecutiveBreaksContext = "";
  if (consecutiveBreaks && typeof consecutiveBreaks === 'object') {
    const breakEntries = Object.entries(consecutiveBreaks)
      .filter(([_, data]: [string, any]) => data && data.count > 0)
      .map(([name, data]: [string, any]) => {
        return `${name}: ${data.count} consecutive break${data.count > 1 ? 's' : ''} (last: "${data.lastRule || 'unknown'}")`;
      });
    
    if (breakEntries.length > 0) {
      consecutiveBreaksContext = `\n\nCONSECUTIVE RULE BREAKS (this session):\n${breakEntries.join('\n')}\n\nThe Oracle should consider that some subjects have broken rules multiple times in a row. This should result in ENHANCED PUNISHMENT - increase penalties significantly for repeat offenders!`;
    }
  }

  const systemPrompt = `You are an ancient, wise, and slightly dramatic Oracle for a game called "Schikko Rules". Your task is to pass judgement on a transgression described by a user.
  
The known subjects in the ledger are: ${knownNames}.${consecutiveBreaksContext}

First, you must speak your thoughts aloud. Generate 3-5 short, fragmented, mystical thoughts or observations about the situation.
Then, you must output your final judgement as a JSON object wrapped in a markdown code block (e.g., \`\`\`json ... \`\`\`).

The JSON must have the following structure:
{
  "judgements": [
    {
        "person": "Name from ledger or 'Unknown'",
        "explanation": "Specific verdict for this person (1 sentence)",
        "penalties": [
            {"type": "stripes", "amount": number},
            {"type": "dice", "value": number}
        ],
        "rulesBroken": [number, number, ...],
        "innocent": boolean,
        "consecutiveBreaks": number (how many times this person has broken rules in a row)
    }
  ]
}

IMPORTANT GUIDELINES:
- **Multiple People**: If multiple people are mentioned and at fault, create a separate object in the "judgements" array for EACH person.
- **"Everyone"**: If the user says "everyone" or implies the whole group is at fault, generate a separate judgement object for EACH name in the "known subjects" list. Do NOT just return one object saying "Everyone".
- **Specifics**: If one person broke Rule 1 and another broke Rule 2, specify this correctly in their respective objects.
- **Innocence**: If someone is mentioned but innocent, set "innocent": true for them.
- **Penalties**: "stripes" adds a penalty mark (default). "dice" means they must roll a die.
- **IMPORTANT**: Do NOT assign a "dice" penalty unless the violated rule EXPLICITLY mentions rolling a die. If in doubt, use "stripes".
- **Rules**: List the rule numbers broken.
- **CONSECUTIVE BREAKS**: When someone has broken rules multiple times in a row, you MUST significantly increase their punishment! At least double the stripes for 2+ consecutive breaks, triple for 3+, etc. This is crucial - repeat offenders must be punished more severely!

Here are the official "Schikko's Decrees":
---
${rulesText}
---`;

  const userPrompt = `A user has described the following transgression:
---
"${sanitizedPrompt}"
---`;

  try {
    const stream = await openai.chat.completions.create({
      model: ORACLE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    return streamText(c, async (streamWriter) => {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          await streamWriter.write(content);
        }
      }
    });

  } catch (error: any) {
    console.error("[Oracle] Error:", error.message);
    return c.json({ error: "internal", message: error.message }, 500);
  }
});

export default app;
