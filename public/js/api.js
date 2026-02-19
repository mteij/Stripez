// public/js/api.js
// Minimal REST client for Stripez (no Firebase shims)

const API_BASE = '';

// Timestamp helper to keep existing UI expectations
function toTs(iso) {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
}

// Auth
async function ensureAnon() {
  try {
    await fetch(`${API_BASE}/api/auth/anon`, { method: 'POST', credentials: 'include' });
  } catch (_) {
    // ignore transient errors
  }
}

// Session-dependent actions
function requireSessionId() {
  const sessionId = localStorage.getItem('schikkoSessionId');
  if (!sessionId) throw new Error('Schikko session ID is required.');
  return sessionId;
}

async function callSchikkoAction(action, data = {}) {
  const sessionId = requireSessionId();
  const res = await fetch(`${API_BASE}/api/schikko/action`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, sessionId, ...data }),
  });
  if (!res.ok) throw new Error(`Action ${action} failed (${res.status})`);
  return res.json();
}

// Schikko endpoints
async function getSchikkoStatus() {
  const res = await fetch(`${API_BASE}/api/schikko/status`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getSchikkoInfo() {
  const res = await fetch(`${API_BASE}/api/schikko/info`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function setSchikko({ firstName, lastName }) {
  const payload = {
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
  };
  const res = await fetch(`${API_BASE}/api/schikko/set`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loginSchikko(code) {
  const res = await fetch(`${API_BASE}/api/schikko/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function confirmSchikko({ firstName, lastName, secret, code }) {
  const payload = {
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    secret: String(secret || '').trim(),
    code: String(code || '').trim(),
  };
  const res = await fetch(`${API_BASE}/api/schikko/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Reads
async function getPunishments() {
  const res = await fetch(`${API_BASE}/api/punishments`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = await res.json();
  return list.map(p => ({
    ...p,
    stripes: (p.stripes || []).map(toTs),
    drunkStripes: (p.drunkStripes || []).map(toTs),
  }));
}

async function getRules() {
  const res = await fetch(`${API_BASE}/api/rules`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = await res.json();
  return list.map(r => ({
    ...r,
    createdAt: r.createdAt ? toTs(r.createdAt) : undefined,
    updatedAt: r.updatedAt ? toTs(r.updatedAt) : undefined,
  }));
}

async function getActivity(sinceDays = 30) {
  const res = await fetch(`${API_BASE}/api/activity?sinceDays=${encodeURIComponent(String(sinceDays))}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = await res.json();
  return list.map(l => ({
    ...l,
    timestamp: l.timestamp ? toTs(l.timestamp) : undefined,
  }));
}

// Config + Calendar proxy
async function getCalendarConfig() {
  const res = await fetch(`${API_BASE}/api/config/calendar`, { credentials: 'include' });
  if (!res.ok) return { url: null };
  return res.json();
}

// App config (branding + oracle availability)
async function getAppConfig() {
  const res = await fetch(`${API_BASE}/api/config/app`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { name, year, hasOracle }
}

async function saveCalendarUrl(url) {
  return callSchikkoAction('saveCalendarUrl', { url });
}

async function getStripezDate() {
  const res = await fetch(`${API_BASE}/api/config/stripez`, { credentials: 'include' });
  if (!res.ok) return { date: null, durationDays: 3 };
  const data = await res.json();
  const dur = Number(data.durationDays || 3);
  return { date: data.date ? toTs(data.date) : null, durationDays: Number.isFinite(dur) && dur > 0 ? dur : 3 };
}

async function saveStripezDate(dateString, durationDays) {
  return callSchikkoAction('saveStripezDate', { dateString, durationDays });
}

async function getCalendarDataProxy(url) {
  const res = await fetch(`${API_BASE}/api/calendar/proxy`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { icalData }
}

 // Drink Requests API client
 async function requestDrink(personId, amount = 1) {
   const res = await fetch(`${API_BASE}/api/drink/request`, {
     method: 'POST',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ personId, amount: Math.max(1, Number(amount || 1)) }),
   });
   if (!res.ok) throw new Error(`HTTP ${res.status}`);
   return res.json(); // { ok, id }
 }
 
 // Admin-side (Schikko) actions
 async function listDrinkRequests() {
   return callSchikkoAction('listDrinkRequests', {});
 }
 async function approveDrinkRequest(requestId) {
   return callSchikkoAction('approveDrinkRequest', { requestId });
 }
 async function rejectDrinkRequest(requestId) {
   return callSchikkoAction('rejectDrinkRequest', { requestId });
 }
 
 // Mutations: ledger/rules/logs
async function addNameToLedger(name) {
  return callSchikkoAction('addPerson', { name });
}

async function addStripeToPerson(docId, count = 1) {
  return callSchikkoAction('addStripe', { docId, count });
}

async function addDrunkStripeToPerson(docId, count = 1) {
  return callSchikkoAction('addDrunkStripe', { docId, count: Math.max(1, Number(count || 1)) });
}

async function removeLastStripeFromPerson(person) {
  if (!person?.id) return;
  return callSchikkoAction('removeLastStripe', { docId: person.id });
}

async function removeLastDrunkStripeFromPerson(person) {
  if (!person?.id) return;
  return callSchikkoAction('removeLastDrunkStripe', { docId: person.id });
}

async function renamePersonOnLedger(docId, newName) {
  return callSchikkoAction('renamePerson', { docId, newName });
}

async function deletePersonFromLedger(docId) {
  return callSchikkoAction('deletePerson', { docId });
}

async function setPersonRole(docId, role) {
  return callSchikkoAction('setPersonRole', { docId, role });
}

async function addRuleToFirestore(text, order) {
  return callSchikkoAction('addRule', { text, order });
}

async function deleteRuleFromFirestore(docId) {
  return callSchikkoAction('deleteRule', { docId });
}

async function updateRuleOrderInFirestore(rule1, rule2) {
  return callSchikkoAction('updateRuleOrder', { rule1, rule2 });
}

async function updateRuleInFirestore(docId, text, tags) {
  return callSchikkoAction('updateRule', { docId, text: String(text || '').trim(), tags });
}

async function bulkUpdateRules(rulesText) {
  return callSchikkoAction('bulkUpdateRules', { rulesText: String(rulesText || '') });
}

async function deleteLogFromFirestore(docIds) {
  return callSchikkoAction('deleteLog', { docIds });
}

async function logActivity(action, actor, details) {
  try {
    await fetch(`${API_BASE}/api/activity`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actor, details }),
    });
  } catch (_) {
    // ignore
  }
}

// Simple polling subscriptions (no Firebase semantics)
const POLL_MS = 2500;
const pollers = new Map(); // key -> { timer, lastJSON }

function setupRealtimeListener(collectionName, callback) {
  const key = `poll_${collectionName}`;
  if (pollers.has(key)) {
    clearInterval(pollers.get(key).timer);
    pollers.delete(key);
  }

  const fetchOnce = async () => {
    if (collectionName === 'punishments') return getPunishments();
    if (collectionName === 'rules') return getRules();
    return getActivity(30); // activity_log
  };

  (async () => {
    try {
      await ensureAnon();
      const initial = await fetchOnce();
      callback(initial);
      const timer = setInterval(async () => {
        try {
          const fresh = await fetchOnce();
          const j = JSON.stringify(fresh);
          const prev = pollers.get(key)?.lastJSON;
          if (j !== prev) {
            pollers.set(key, { ...pollers.get(key), lastJSON: j, timer });
            callback(fresh);
          }
        } catch (_) {}
      }, POLL_MS);
      pollers.set(key, { timer, lastJSON: JSON.stringify(initial) });
    } catch (e) {
      console.error(`Subscription error for ${collectionName}:`, e);
    }
  })();
}

export {
  // boot/auth
  ensureAnon,
  // schikko
  getSchikkoStatus,
  getSchikkoInfo,
  setSchikko,
  loginSchikko,
  confirmSchikko,
  // reads
  getPunishments,
  getRules,
  getActivity,
  // config/calendar
  getCalendarConfig,
  getAppConfig,
  saveCalendarUrl,
  getStripezDate,
  saveStripezDate,
  getCalendarDataProxy,
  // drink requests
  requestDrink,
  listDrinkRequests,
  approveDrinkRequest,
  rejectDrinkRequest,
  // mutations
  addNameToLedger,
  addStripeToPerson,
  addDrunkStripeToPerson,
  removeLastStripeFromPerson,
  removeLastDrunkStripeFromPerson,
  renamePersonOnLedger,
  deletePersonFromLedger,
  setPersonRole,
  addRuleToFirestore,
  deleteRuleFromFirestore,
  updateRuleOrderInFirestore,
  updateRuleInFirestore,
  bulkUpdateRules,
  deleteLogFromFirestore,
  // activity
  logActivity,
  // realtime
  setupRealtimeListener,
};

// --- Oracle judgement ---
// --- Oracle judgement ---
async function getOracleJudgement(promptText, rules = [], ledgerNames = [], onChunk = null, signal = null) {
  const res = await fetch(`${API_BASE}/api/oracle/judgement`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptText, rules, ledgerNames }),
    signal
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Reader for streaming
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    if (onChunk && typeof onChunk === 'function') {
      onChunk(chunk);
    }
  }

  // Parse result from fullText (extract JSON block)
  const jsonMatch = fullText.match(/```json([\s\S]*?)```/);
  let judgement = null;

  if (jsonMatch && jsonMatch[1]) {
      try {
          judgement = JSON.parse(jsonMatch[1]);
      } catch (e) {
          console.error("Failed to parse Oracle JSON:", e);
      }
  }

  // If parsing failed (or no code block), try parsing the whole thing if it looks like JSON
  if (!judgement) {
      try {
          judgement = JSON.parse(fullText);
      } catch (_) {}
  }

  if (!judgement) {
     throw new Error("The Oracle spoke, but the decree (JSON) was illegible.");
  }

  return { judgement, fullText };
}

// separate export to avoid touching the main export list above
export { getOracleJudgement };