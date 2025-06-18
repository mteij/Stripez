// public/js/firebase.js

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, deleteDoc, writeBatch, serverTimestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 

// Firebase configuration. These placeholders will be replaced by GitHub Actions
// during the build/deploy process using a string replacement utility.
const firebaseConfig = {
    apiKey: "VITE_FIREBASE_API_KEY",
    authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
    projectId: "VITE_FIREBASE_PROJECT_ID",
    storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
    appId: "VITE_FIREBASE_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- COLLECTION REFERENCES ---
const ledgerCollectionRef = collection(db, 'punishments');
const rulesCollectionRef = collection(db, 'rules');
const configCollectionRef = collection(db, 'config');

// --- DATABASE AND AUTH FUNCTIONS ---

/**
 * Sets up a real-time listener for a specified collection.
 * @param {string} collectionName - The name of the collection ('punishments' or 'rules').
 * @param {Function} callback - The function to call with the updated data.
 */
const setupRealtimeListener = (collectionName, callback) => {
    const collRef = collectionName === 'rules' ? rulesCollectionRef : ledgerCollectionRef;
    onSnapshot(query(collRef), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => console.error("Error fetching ledger:", error));
};

const getCalendarConfig = async () => {
    const docRef = doc(db, 'config', 'calendar');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        return { url: null };
    }
};

const saveCalendarUrl = async (url) => {
    const docRef = doc(db, 'config', 'calendar');
    await setDoc(docRef, { url: url }, { merge: true });
};

const addNameToLedger = async (name, userId) => {
    await addDoc(ledgerCollectionRef, { name, stripes: [], drunkStripes: [], addedBy: userId }); // Changed to 'drunkStripes'
};

const addStripeToPerson = async (docId) => {
    const docRef = doc(db, 'punishments', docId);
    await updateDoc(docRef, { stripes: arrayUnion(new Date()) });
};

const removeLastStripeFromPerson = async (person) => {
    if (person && Array.isArray(person.stripes) && person.stripes.length > 0) {
        const docRef = doc(db, 'punishments', person.id);
        
        // Sort in descending order to get the latest timestamp to remove
        const sortedStripes = [...person.stripes].sort((a, b) => b.toMillis() - a.toMillis());
        const lastStripeToRemove = sortedStripes[0];

        // 1. Remove the normal stripe from Firestore
        await updateDoc(docRef, { stripes: arrayRemove(lastStripeToRemove) });

        // 2. Fetch the updated document immediately to get the latest state after the first update
        const updatedSnap = await getDoc(docRef);
        const updatedPersonData = updatedSnap.data();

        let currentNormalStripes = updatedPersonData.stripes?.length || 0;
        let currentDrunkStripes = updatedPersonData.drunkStripes?.length || 0;
        
        // Determine how many drunk stripes need to be removed to maintain consistency
        let drunkStripesToRemove = [];
        if (currentDrunkStripes > currentNormalStripes) {
            const diff = currentDrunkStripes - currentNormalStripes;
            // Sort drunk stripes by timestamp in descending order to remove the most recent ones
            const sortedDrunkStripes = [...(updatedPersonData.drunkStripes || [])].sort((a, b) => b.toMillis() - a.toMillis());
            
            // Collect the timestamps of the drunk stripes to be removed
            for (let i = 0; i < diff; i++) {
                if (sortedDrunkStripes[i]) {
                    drunkStripesToRemove.push(sortedDrunkStripes[i]);
                }
            }
        }

        // 3. If any drunk stripes need to be removed, perform this update in a batch
        if (drunkStripesToRemove.length > 0) {
            const batch = writeBatch(db);
            drunkStripesToRemove.forEach(ts => {
                batch.update(docRef, { drunkStripes: arrayRemove(ts) });
            });
            await batch.commit();
        }
    }
};

const renamePersonOnLedger = async (docId, newName) => {
    const docRef = doc(db, 'punishments', docId);
    await updateDoc(docRef, { name: newName.trim() });
};

const deletePersonFromLedger = async (docId) => {
    const docRef = doc(db, 'punishments', docId);
    await deleteDoc(docRef).catch(error => console.error("Error removing document: ", error));
};

const addRuleToFirestore = async (text, order) => {
    await addDoc(rulesCollectionRef, { text, order, tags: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
};

const deleteRuleFromFirestore = async (docId) => {
    const docRef = doc(db, 'rules', docId);
    await deleteDoc(docRef);
};

const updateRuleOrderInFirestore = async (rule1, rule2) => {
    const batch = writeBatch(db);

    const rule1Ref = doc(db, "rules", rule1.id);
    batch.update(rule1Ref, { order: rule2.order, updatedAt: serverTimestamp() });

    const rule2Ref = doc(db, "rules", rule2.id);
    batch.update(rule2Ref, { order: rule1.order, updatedAt: serverTimestamp() });

    await batch.commit();
};

const updateRuleInFirestore = async (docId, newText, tags) => {
    const docRef = doc(db, 'rules', docId);
    await updateDoc(docRef, { 
        text: newText.trim(), 
        tags: tags,
        updatedAt: serverTimestamp() 
    });
};

/**
 * Adds 'count' drunk stripes to a person's document.
 * Ensures each timestamp is distinct to prevent deduplication by Firestore.
 * @param {string} docId - The document ID of the person.
 * @param {number} count - The number of drunk stripes to add.
 */
const addDrunkStripeToPerson = async (docId, count) => { 
    const docRef = doc(db, 'punishments', docId);
    const batch = writeBatch(db); 

    for (let i = 0; i < count; i++) {
        // Create a distinct timestamp for each stripe.
        // Adding 'i' milliseconds ensures uniqueness even if calls are very fast.
        const distinctTimestamp = new Date(Date.now() + i); 
        batch.update(docRef, { drunkStripes: arrayUnion(distinctTimestamp) }); // Changed to 'drunkStripes'
    }
    
    await batch.commit();
};

/**
 * Removes the last added drunk stripe from a person's document.
 * @param {object} person - The person object from the ledger.
 */
const removeLastDrunkStripeFromPerson = async (person) => {
    if (person && Array.isArray(person.drunkStripes) && person.drunkStripes.length > 0) { // Changed to 'drunkStripes'
        const docRef = doc(db, 'punishments', person.id);
        // Sort by timestamp (most recent first) to remove the last one added
        const sortedDrunkStripes = [...person.drunkStripes].sort((a, b) => b.toMillis() - a.toMillis()); // Changed to 'drunkStripes'
        const lastDrunkStripe = sortedDrunkStripes[0];
        await updateDoc(docRef, { drunkStripes: arrayRemove(lastDrunkStripe) }); // Changed to 'drunkStripes'
    }
};


// Export everything needed by other modules
export {
    auth,
    onAuthStateChanged,
    signInAnonymously,
    setupRealtimeListener,
    addNameToLedger,
    addStripeToPerson,
    removeLastStripeFromPerson,
    renamePersonOnLedger,
    deletePersonFromLedger,
    addRuleToFirestore,
    deleteRuleFromFirestore,
    updateRuleOrderInFirestore,
    updateRuleInFirestore,
    addDrunkStripeToPerson, 
    removeLastDrunkStripeFromPerson,
    getCalendarConfig,
    saveCalendarUrl
};