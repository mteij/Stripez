import { state } from './state.js';
import { dom } from './dom.js';
import { getOracleJudgement, addStripeToPerson, logActivity } from '../api.js';
import { rollDiceAndAssign } from '../../randomizer/randomizer.js';
import { showAlert } from '../ui.js';

let whisperInterval = null;
let particleInterval = null;
let blobInteractionHandler = null;

export function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function spawnWhispers(overlay) {
    const words = [
        "Likken", "Schikken", "Likken of Schikken?", "STREEPJESSS", "STRIPESSS", 
        "NICAT", "3.2.1. NICAT", "BUCOM'vo", "Hype",
        "JUSTICE", "VERDICT", "PENALTY", "DECISION", "FATE", "SILENCE", "TRUTH"
    ];

    whisperInterval = setInterval(() => {
        if (!document.body.contains(overlay)) {
            clearInterval(whisperInterval);
            return;
        }

        const whisper = document.createElement('span');
        whisper.className = 'oracle-whisper';
        whisper.textContent = words[Math.floor(Math.random() * words.length)];
        
        const x = Math.random() * 90;
        const y = 60 + Math.random() * 40;
        
        whisper.style.left = `${x}%`;
        whisper.style.top = `${y}%`;
        whisper.style.fontSize = `${0.8 + Math.random() * 1}rem`;
        
        overlay.appendChild(whisper);

        setTimeout(() => {
            if (whisper.parentNode) whisper.parentNode.removeChild(whisper);
        }, 4000);

    }, 400);
}

export function spawnParticles(container) {
    if (!container) return;
    
    particleInterval = setInterval(() => {
        if (!document.body.contains(container)) {
            clearInterval(particleInterval);
            return;
        }

        const particle = document.createElement('div');
        particle.className = 'oracle-particle';
        
        const size = 2 + Math.random() * 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        particle.style.left = '50%';
        particle.style.top = '50%';
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = 50 + Math.random() * 100;
        const duration = 1500 + Math.random() * 1500;
        
        container.appendChild(particle);
        
        const keyframes = [
            { transform: `translate(-50%, -50%) scale(1)`, opacity: 0.8 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * velocity}px), calc(-50% + ${Math.sin(angle) * velocity}px)) scale(0)`, opacity: 0 }
        ];
        
        const animation = particle.animate(keyframes, {
            duration: duration,
            easing: 'ease-out'
        });
        
        animation.onfinish = () => {
             if (particle.parentNode) particle.parentNode.removeChild(particle);
        };
        
    }, 100);
}

export function createActionButtons(parsedJudgement) {
    dom.geminiActionButtonsContainer.innerHTML = ''; 
    if (dom.geminiOutput && dom.geminiOutput.parentNode) {
        if (!dom.geminiActionButtonsContainer.parentNode || dom.geminiActionButtonsContainer.parentNode !== dom.geminiOutput.parentNode) {
            try {
                dom.geminiOutput.parentNode.appendChild(dom.geminiActionButtonsContainer);
            } catch (e) {
                try { dom.geminiOutput.parentNode.insertBefore(dom.geminiActionButtonsContainer, dom.geminiOutput); } catch (_) {}
            }
        }
    }
    
    // For non-Schikko users
    if (!state.isSchikkoSessionActive) {
         const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Acknowledge Judgement`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    if (parsedJudgement.innocent) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `The Oracle declares ${parsedJudgement.person || 'Someone'} innocent.`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle declared ${parsedJudgement.person || 'Someone'} innocent.`);
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    const targetPersonName = parsedJudgement.person || 'Someone';
    const person = state.ledgerDataCache.find(p => p.name.toLowerCase() === targetPersonName.toLowerCase());

    if (!person) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Person "${targetPersonName}" not found. Acknowledge.`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    let totalStripes = 0;
    const diceRolls = []; 
    
    if (Array.isArray(parsedJudgement.penalties)) {
        parsedJudgement.penalties.forEach(penalty => {
            if (penalty.type === 'stripes' && typeof penalty.amount === 'number') {
                totalStripes += penalty.amount;
            } else if (penalty.type === 'dice' && typeof penalty.value === 'number') {
                diceRolls.push(penalty.value);
            }
        });
    }

    const hasStripes = totalStripes > 0;
    const hasDice = diceRolls.length > 0;

    if (hasStripes && !hasDice) {
        const stripesBtn = document.createElement('button');
        stripesBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        stripesBtn.textContent = `Add ${totalStripes} Stripes to ${person.name}`;
        stripesBtn.onclick = async (e) => {
            e.stopPropagation();
            await addStripeToPerson(person.id, totalStripes);
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed ${totalStripes} stripe(s) to ${person.name}.`);
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(stripesBtn);
    } else if (!hasStripes && hasDice) {
        const diceBtn = document.createElement('button');
        diceBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        diceBtn.textContent = `Roll Dice for ${person.name}`;
        diceBtn.onclick = (e) => {
            e.stopPropagation();
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed a dice roll for ${person.name}.`);
            rollDiceAndAssign(diceRolls, person, addStripeToPerson, state.ledgerDataCache, showAlert); 
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(diceBtn);
    } else if (hasStripes && hasDice) {
        const combinedBtn = document.createElement('button');
        combinedBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        combinedBtn.textContent = `Add ${totalStripes} Stripes & Roll Dice for ${person.name}`;
        combinedBtn.onclick = async (e) => {
            e.stopPropagation();
            await addStripeToPerson(person.id, totalStripes);
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed ${totalStripes} stripe(s) to ${person.name}.`);
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle also decreed a dice roll for ${person.name}.`);
            rollDiceAndAssign(diceRolls, person, addStripeToPerson, state.ledgerDataCache, showAlert, state.isSchikkoSessionActive);
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(combinedBtn);
    } else {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Acknowledge Judgement`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            dom.geminiModal.classList.add('hidden');
        };
        dom.geminiActionButtonsContainer.appendChild(acknowledgeBtn);
    }
}

export async function handleGeminiSubmit() {
    const inputText = dom.geminiInput.value.trim();
    if (inputText === '') {
        dom.geminiOutput.textContent = 'The Oracle cannot judge the unspoken. Inscribe the transgression.';
        dom.geminiOutput.classList.remove('hidden');
        return;
    }

    const modalContent = dom.geminiModal.querySelector('.modal-content');
    const rect = modalContent.getBoundingClientRect();

    dom.geminiModal.classList.add('hidden');
    dom.geminiInput.value = '';

    const overlay = document.createElement('div');
    overlay.className = 'oracle-fullscreen-overlay oracle-zoom-transition';
    
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.transform = 'none';
    
    overlay.style.background = getComputedStyle(modalContent).background;
    overlay.style.borderColor = getComputedStyle(modalContent).borderColor;
    overlay.style.borderWidth = getComputedStyle(modalContent).borderWidth;

    document.body.appendChild(overlay);
    overlay.getBoundingClientRect();

    requestAnimationFrame(() => {
        overlay.classList.add('oracle-zoom-fullscreen');
    });

    overlay.innerHTML = `
        <div class="oracle-content-center" style="opacity: 0; transition: opacity 1s ease 0.6s; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
             <div class="oracle-thinking-text slide-in-bottom" style="text-align: center;">CONSULTING THE ORACLE...</div>
        </div>
    `;
    
    const centerContent = overlay.querySelector('.oracle-content-center');

    setTimeout(() => {
        centerContent.style.opacity = '1';
        spawnWhispers(overlay); 
    }, 600);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'absolute top-4 right-4 text-white text-4xl hover:text-red-500 z-50 transition-colors focus:outline-none';
    closeBtn.style.zIndex = '100'; 
    closeBtn.title = "Cancel Oracle Consultation";
    overlay.appendChild(closeBtn);

    const controller = new AbortController();
    
    closeBtn.onclick = () => {
        controller.abort();
        overlay.remove();
        clearInterval(whisperInterval);
        clearInterval(particleInterval);
        dom.geminiModal.classList.add('hidden');
    };

    try {
        const result = await getOracleJudgement(
            inputText,
            state.rulesDataCache,
            state.ledgerDataCache.map(person => person.name),
            null,
            controller.signal
        );

        await new Promise(r => setTimeout(r, 1500));

        const rawJudgement = result.judgement;
        let judgements = [];
        
        if (rawJudgement.judgements && Array.isArray(rawJudgement.judgements)) {
            judgements = rawJudgement.judgements;
        } else if (Array.isArray(rawJudgement)) {
            judgements = rawJudgement;
        } else {
            judgements = [rawJudgement];
        }

        judgements.forEach(j => {
             if (j.person && j.person.toLowerCase() !== 'unknown') {
                 const match = state.ledgerDataCache.find(p => p.name.toLowerCase() === j.person.toLowerCase());
                 if (match) {
                     j._personId = match.id;
                     j._personName = match.name;
                 }
             }
        });

        clearInterval(whisperInterval);
        clearInterval(particleInterval);
        
        document.querySelectorAll('.oracle-whisper').forEach(el => el.remove());
        overlay.classList.add('oracle-result-vignette');

        let verdictsHtml = '';
        
        if (judgements.length === 0) {
             verdictsHtml = `<div class="text-red-400 italic">The Oracle stares in silence. (No judgement returned)</div>`;
        } else {
             verdictsHtml = `<div class="flex flex-col gap-6 w-full max-w-4xl mx-auto">`;
             
             const guiltyJudgements = judgements.filter(j => !j.innocent);

             if (guiltyJudgements.length === 0) {
                 verdictsHtml += `
                    <div class="text-center p-8 border border-[#5c3d2e] bg-black/40 rounded-lg">
                        <h3 class="text-3xl text-green-400 font-cinzel-decorative font-bold mb-4">Peace Reigns</h3>
                        <p class="text-xl text-[#fdf8e9] italic">The Oracle finds no fault in anyone.</p>
                    </div>
                 `;
             } else {
                 guiltyJudgements.forEach((j, index) => {
                     const personName = j._personName || j.person || 'Unknown Subject';
                     let verdictText = '';
                     let penalties = [];
                     if (j.penalties) {
                         j.penalties.forEach(p => {
                             if (p.type === 'stripes') penalties.push(`${p.amount} Stripe${p.amount > 1 ? 's' : ''}`);
                             if (p.type === 'dice') penalties.push(`Roll d${p.value}`);
                         });
                     }
                     verdictText = `<span class="text-red-500 font-bold">GUILTY</span>: <span class="text-gray-200">${penalties.join(', ') || 'Condemned'}</span>`;
                     
                     if (j.rulesBroken && j.rulesBroken.length > 0) {
                         verdictText += ` <span class="text-sm text-gray-400 block mt-1">(Rule${j.rulesBroken.length > 1 ? 's' : ''} ${j.rulesBroken.join(', ')})</span>`;
                     }
    
                     verdictsHtml += `
                        <div class="bg-black/40 border border-[#5c3d2e] p-6 rounded-lg relative overflow-hidden slide-in-bottom" style="animation-delay: ${index * 0.2}s">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-3xl text-gradient-gold font-cinzel-decorative font-bold">${escapeHTML(personName)}</h3>
                                <div class="text-xl font-serif">${verdictText}</div>
                            </div>
                            <p class="text-gray-300 italic border-l-2 border-[#5c3d2e] pl-4 leading-relaxed">
                                "${escapeHTML(j.explanation || 'The Oracle has spoken.')}"
                            </p>
                        </div>
                     `;
                 });
             }
             verdictsHtml += `</div>`;
        }

        centerContent.innerHTML = `
            <div class="mb-6 slide-in-bottom stagger-reveal w-full">
                 <div class="mb-8 text-center">
                    <h2 class="text-5xl font-cinzel-decorative mb-2 font-bold tracking-wider text-gradient-gold">The Oracle Has Spoken</h2>
                    <div class="h-px w-48 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent mx-auto mb-6 opacity-70"></div>
                 </div>
                 ${verdictsHtml}
            </div>
            <div id="oracle-overlay-actions" class="flex flex-wrap justify-center gap-4 mt-8"></div>
        `;
        
        const actionContainer = document.getElementById('oracle-overlay-actions');
        
        const closeOverlay = () => {
             if (blobInteractionHandler) {
                window.removeEventListener('mousemove', blobInteractionHandler);
            }
            document.body.removeChild(overlay);
            dom.geminiInput.value = '';
        };

        if (actionContainer) {
             if (!state.isSchikkoSessionActive) {
                    const btn = document.createElement('button');
                     btn.className = 'btn-punishment px-6 py-3 rounded-md text-xl font-bold';
                    btn.textContent = 'Acknowledge';
                    btn.onclick = closeOverlay;
                    actionContainer.appendChild(btn);
             } else {
                 if (judgements.length === 0) {
                      const btn = document.createElement('button');
                      btn.className = 'btn-ancient px-6 py-3 rounded-md text-xl font-bold';
                      btn.textContent = 'Leave in Confusion';
                      btn.onclick = closeOverlay;
                      actionContainer.appendChild(btn);
                 } else {
                     let anyoneGuilty = false;
                     judgements.forEach(j => {
                         const personName = j._personName || j.person || 'Unknown';
                         if (j._personId && !j.innocent) {
                             anyoneGuilty = true;
                             let totalStripes = 0;
                             let diceRolls = [];
                             
                             if (j.penalties) {
                                 j.penalties.forEach(p => {
                                     if (p.type === 'stripes') totalStripes += (p.amount || 0);
                                     if (p.type === 'dice') diceRolls.push(p.value);
                                 });
                             }
                             
                             const hasStripes = totalStripes > 0;
                             const hasDice = diceRolls.length > 0;
                             
                             if (hasStripes || hasDice) {
                                 const btn = document.createElement('button');
                                 let label = `Punish ${personName}`;
                                 if (hasStripes) label += ` (+${totalStripes})`;
                                 if (hasDice) label += ` (🎲)`;
                                 
                                 btn.className = 'btn-oracle-action px-6 py-3 rounded-lg text-lg font-bold tracking-wide m-2';
                                 btn.textContent = label;
                                 
                                 btn.onclick = async () => {
                                     btn.disabled = true;
                                     btn.classList.add('done');
                                     
                                     if (hasStripes) {
                                         await addStripeToPerson(j._personId, totalStripes);
                                         await logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed ${totalStripes} stripe(s) to ${personName}.`);
                                     }
                                     
                                     if (hasDice) {
                                          await logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed a dice roll for ${personName}.`);
                                          setTimeout(() => {
                                              const event = new CustomEvent('open-dice-modal', { 
                                                  detail: { diceValues: diceRolls, personId: j._personId } 
                                              });
                                              window.dispatchEvent(event);
                                          }, 200);
                                     }
                                     
                                     btn.textContent = `${personName} Punished.`;
                                 };
                                 actionContainer.appendChild(btn);
                             }
                         }
                     });
                     
                     const doneBtn = document.createElement('button');
                     doneBtn.className = 'btn-ancient px-8 py-3 rounded-lg text-xl font-bold tracking-wide ml-4';
                     doneBtn.textContent = anyoneGuilty ? 'Done' : 'Acknowledge';
                     doneBtn.onclick = closeOverlay;
                     actionContainer.appendChild(doneBtn);
                 }
             }
        }

    } catch (error) {
        console.error("Error calling Oracle function:", error);
        clearInterval(whisperInterval);
        clearInterval(particleInterval);
        
        let errorMessage = `The Oracle is silent. An error occurred: ${error.message}`;
        centerContent.innerHTML = `
            <div class="mb-6">
                <h2 class="text-3xl text-red-600 font-cinzel-decorative mb-4 font-bold">The Void Rejects You</h2>
                <p class="text-red-300">${escapeHTML(errorMessage)}</p>
            </div>
            <button id="oracle-error-close" class="btn-ancient px-6 py-3 rounded-md text-xl font-bold">Flee</button>
        `;
        const closeErrBtn = document.getElementById('oracle-error-close');
        if(closeErrBtn) {
            closeErrBtn.onclick = () => {
                document.body.removeChild(overlay);
            };
        }
        dom.geminiModal.classList.remove('hidden');
    }
}
