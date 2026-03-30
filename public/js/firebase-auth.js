// public/js/firebase-auth.js
// Wraps Firebase Auth for Google sign-in using the compat CDN build.

let _app = null;

function getApp() {
    const cfg = window.__firebaseConfig;
    if (!cfg?.apiKey || !cfg?.projectId) return null;
    if (typeof firebase === 'undefined') return null;
    if (!_app) {
        try {
            _app = firebase.initializeApp(cfg);
        } catch {
            // Already initialized
            _app = firebase.app();
        }
    }
    return _app;
}

export function isGoogleLoginAvailable() {
    return Boolean(
        window.__firebaseConfig?.apiKey &&
        window.__firebaseConfig?.projectId &&
        typeof firebase !== 'undefined'
    );
}

export async function signInWithGoogle() {
    const app = getApp();
    if (!app) throw new Error('Firebase not configured');
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    return {
        idToken: await user.getIdToken(true),
        email: String(user?.email || '').trim().toLowerCase(),
        displayName: String(user?.displayName || '').trim(),
    };
}
