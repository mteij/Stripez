import { state } from './state.js';
import { dom } from './dom.js';
import { getSchikkoStatus, loginSchikko, listDrinkRequests } from '../api.js';
import { showConfirm, showLoading, hideLoading, showAlert, showSchikkoLoginModal } from '../ui.js';
import { handleRender, handleRenderRules } from './render.js';
import { loadAndRenderAppCountdown, updateAppFooter } from '../main.js';

export async function handleLogin() {
    await ensureSchikkoSession();
}

export async function handleLogout() {
    const confirmed = await showConfirm("Are you sure you want to log out as Schikko? This will end your administrative session.", "Confirm Logout");
    if (confirmed) {
        showLoading('Logging out...');
        localStorage.removeItem('schikkoSessionId');
        state.isSchikkoSessionActive = false;
        updateGuestUI();
        updateAppFooter();
        await new Promise(r => setTimeout(r, 300));
        hideLoading();
        await showAlert("You have logged out.", "Logout Successful");
    }
}

export function updateGuestUI() {
    const isGuest = !state.isSchikkoSessionActive;

    document.querySelectorAll('[data-action="add-stripe"]').forEach(btn => btn.classList.toggle('hidden', isGuest));
    document.querySelectorAll('[data-action="toggle-menu"]').forEach(btn => btn.classList.toggle('hidden', isGuest));
    document.querySelectorAll('[data-action="toggle-stripe-menu"]').forEach(btn => btn.classList.toggle('hidden', isGuest));
    
    if (dom.editRulesBtn) dom.editRulesBtn.classList.toggle('hidden', isGuest);
    if (dom.bulkEditBtn) dom.bulkEditBtn.classList.toggle('hidden', isGuest);
    if (dom.addDecreeBtn) dom.addDecreeBtn.classList.toggle('hidden', isGuest);
    if (dom.addBtn) dom.addBtn.classList.toggle('hidden', isGuest);
    if (dom.editCalendarBtn) dom.editCalendarBtn.classList.toggle('hidden', isGuest);
    if (dom.openDrinkRequestsBtn) dom.openDrinkRequestsBtn.classList.toggle('hidden', isGuest);

    if (dom.openLogbookBtn) {
        dom.openLogbookBtn.classList.toggle('hidden', isGuest);
    }
    
    if (dom.schikkoLoginBtn) {
        dom.schikkoLoginBtn.textContent = state.isSchikkoSessionActive ? 'Schikko Logout' : 'Schikko Login';
    }

    handleRender();
    handleRenderRules();
    loadAndRenderAppCountdown();
}

export async function checkSchikkoStatus() {
    try {
        const result = await getSchikkoStatus();
        state.isSchikkoSetForTheYear = result.isSet;

        if (state.isSchikkoSetForTheYear) {
            if (dom.setSchikkoBtn) dom.setSchikkoBtn.classList.add('hidden');
        } else {
            if (dom.setSchikkoBtn) dom.setSchikkoBtn.classList.remove('hidden');
        }
        if (dom.schikkoLoginContainer) dom.schikkoLoginContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error checking Schikko status:", error);
        showAlert("Could not verify the Schikko's status. The archives may be sealed.", "Connection Error");
    }
}

export async function ensureSchikkoSession() {
    if (state.isSchikkoSessionActive) {
        try {
            const sid = localStorage.getItem('schikkoSessionId');
            if (!sid) throw new Error('missing session');
            await listDrinkRequests();
            return true;
        } catch (e) {
            try { localStorage.removeItem('schikkoSessionId'); } catch (_) {}
            state.isSchikkoSessionActive = false;
            try { updateGuestUI(); } catch (_) {}
        }
    }

    const code = await showSchikkoLoginModal();
    if (!code) return false;

    try {
        showLoading('Verifying code...');
        const result = await loginSchikko(code);
        hideLoading();

        if (result?.success && result?.sessionId) {
            localStorage.setItem('schikkoSessionId', result.sessionId);
            state.isSchikkoSessionActive = true;
            await showAlert("Code accepted. You are the Schikko.", "Login Successful");
            updateGuestUI();
            updateAppFooter();
            return true;
        } else {
            await showAlert("The code was incorrect. Access denied.", "Login Failed");
            return false;
        }
    } catch (error) {
        hideLoading();
        console.error("Error during Schikko login:", error);
        await showAlert(`An error occurred: ${error.message}`, "Login Error");
        return false;
    }
}
