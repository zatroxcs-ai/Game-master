// ============================================================
// FICHIER : js/app.js (VERSION V21 - DEBUGGED)
// ============================================================

// --- VARIABLES GLOBALES ---
let currentDeck = [];
let editingType = 'player';
let selectedRelationSubject = null;
let currentGmChannel = 'global';
let pendingMapClick = {x:0, y:0};
let showMarkers = true;
let currentParticipantContext = '';

// --- FONCTION PRINCIPALE DE RAFRAICHISSEMENT ---
function refreshGameData() {
    gameData.players = gameData.players || [];
    gameData.npcs = gameData.npcs || [];
    gameData.logs = gameData.logs || [];
    gameData.relations = gameData.relations || [];
    gameData.chat = gameData.chat || [];
    gameData.journal = gameData.journal || [];
    gameData.quests = gameData.quests || [];
    gameData.maps = gameData.maps || [{ id: 'root', name: 'Monde Principal', img: 'map.png' }];

    if(typeof mapManager !== 'undefined') mapManager.renderList();
    renderMapPins();

    const params = new URLSearchParams(window.location.search);
    if(params.get('mode') === 'client') {
        if(typeof client !== 'undefined') client.render(gameData);
        const r = document.getElementById('mobRegion'); 
        const p = gameData.players.find(x => x.id === parseInt(params.get('id')));
        if(p && r && r.innerHTML.includes("reçues")) r.innerHTML = p.region || "-";
    } else {
        ui.refreshAll();
    }
}

// === UI (MJ) ===
const ui = {
    refreshAll: () => {
        if(!document.getElementById('gm-view')) return;
        if(document.getElementById('gm-view').style.display === 'none') return;

        renderPlayersList();
        renderNPCsList();
        renderJournalList();
        renderQuestList();
        renderLogs();
        
        if (selectedRelationSubject) loadRelationsFor(selectedRelationSubject);
        else renderRelationSubjects();
        
        const cc = document.getElementById('gmChatChannels');
        if(cc) {
            cc.innerHTML = "";
            gameData.players.forEach(p => {
                const active = parseInt(currentGmChannel) === p.id ? 'selected' : '';
                cc.innerHTML += `
                    <div class="list-card-item ${active}" onclick="loadGmChat(${p.id}, '${p.name}')">
                        <img src="${p.img}" class="avatar-circle">
                        <b>${p.name}</b>
                    </div>`;
            });
        }
        const globalTab = document.getElementById('chan-global');
        if(globalTab) globalTab.className = `list-card-item ${currentGmChannel==='global'?'selected':''}`;
        
        renderChat('gmChatFeed', 'gm');
    },

    addLog: (msg) => {
        const t = new Date().toLocaleTimeString('fr-FR');
        gameData.logs.push({ t: t, m: msg });
        if (gameData.logs.length > 50) gameData.logs.shift();
    }
};

// === CLIENT MOBILE ===
const client = {
    lastDeckState: null,

    check: () => {
        const params = new URLSearchParams(window.location.search);
        if(params.get('mode') === 'client') {
            const gmView = document.getElementById('gm-view');
            const clientView = document.getElementById('client-view');
            if(gmView) gmView.style.display = 'none';
            if(clientView) clientView.style.display = 'flex';
            document.title = "Jeu en cours";
            try {
                let u = atob(params.get('u')), k = atob(params.get('k'));
                localStorage.setItem('sb_url', u); 
                localStorage.setItem('sb_key', k); 
                gameData.sessionId = params.get('s'); 
                if(typeof cloud !== 'undefined') cloud.init();
            } catch(e) { 
                const mobName = document.getElementById('mobName');
                if(mobName) mobName.innerText = "ERREUR LIEN"; 
            }
        } else {
            if(typeof cloud !== 'undefined') cloud.init();
        }
    },

    render: (d) => {
        const id = parseInt(new URLSearchParams(window.location.search).get('id'));
        const p = d.players.find(x => x.id === id);
        
        if(p) {
            document.getElementById('mobName').innerText = p.name;
            document.getElementById('mobImg').src = p.img || "https://via.placeholder.com/150";
            
            const regionEl = document.getElementById('mobRegion');
            if(regionEl && !regionEl.innerHTML.includes("Erreur")) regionEl.innerText = p.region || "Inconnu";
            
            document.getElementById('mobGold').innerText = p.gold; 
            document.getElementById('mobElixir').innerText = p.elixir;
            document.getElementById('mobInv').innerText = p.inv || "";

            // Auto-détection Carte
            const currentDeck = p.deck || [];
            if (client.lastDeckState !== null) {
                const newCards = currentDeck.filter(cid => !client.lastDeckState.includes(cid));
                if (newCards.length > 0) playClashCardEffect(newCards[0]);
            }
            client.lastDeckState = [...currentDeck];

            // Deck Display
            const md = document.getElementById('mobDeckDisplay');
            if(md) {
                md.innerHTML = "";
                if(currentDeck.length > 0) {
                    currentDeck.forEach(cid => { 
                        const c = gameData.cards.find(x => x.id == cid); 
                        if(c) md.innerHTML += `<img src="${c.img}" style="width:40px; height:50px; object-fit:contain;">`; 
                    });
                } else md.innerHTML = "<small style='color:#555'>Aucune carte</small>";
            }
            
            // Chat
            const sel = document.getElementById('mobChatTarget');
            if(sel) {
                const curr = sel.value;
                sel.innerHTML = `<option value="global">Global</option><option value="gm">Au MJ</option>`;
                d.players.forEach(o => { if(o.id !== id) sel.innerHTML += `<option value="${o.id}">à ${o.name}</option>`; });
                sel.value = curr;
            }
            renderChat('mobChatFeed', id);

            // Journal
            const jCont = document.getElementById('mobJournalList');
            if(jCont) {
                jCont.innerHTML = "";
                (d.journal || []).sort((a,b)=>b.id-a.id).forEach(j => {
                    jCont.innerHTML += `
                        <div class="mob-journal-entry">
                            <div class="mob-journal-date">${j.date}</div>
                            <div class="mob-journal-title">${j.title}</div>
                            <div class="mob-journal-content">${j.content}</div>
                        </div>`;
                });
            }

            // Quêtes Mobile (Fonction restaurée)
            if(typeof renderMobileQuests === 'function') renderMobileQuests(id);
        }
    },

    switchTab: (t) => {
        document.querySelectorAll('.mob-container').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.mob-tab-btn').forEach(e => e.classList.remove('active'));
        
        const target = document.getElementById('mob-'+t);
        const btn = document.getElementById('tab-'+t);
        if(target) target.classList.add('active');
        if(btn) btn.classList.add('active');
    }
};

// --- NAVIGATION ---
function switchTab(t){
    document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    
    const view = document.getElementById(t);
    if(view) view.classList.add('active');

    const map = {
        'view-map': 0, 'view-chat': 1, 'view-players': 2, 'view-npcs': 3, 
        'view-relations': 4, 'view-quests': 5, 'view-journal': 6, 'view-logs': 7
    };
    const btnIndex = map[t];
    const btns = document.querySelectorAll('#gm-view .nav-tabs .tab-btn');
    if (btns[btnIndex]) btns[btnIndex].classList.add('active');

    if (t === 'view-relations') renderRelationSubjects();
    if (t === 'view-quests') renderQuestList();
}

function saveData(notify = false) {
    if (notify && ui.addLog) ui.addLog("Sauvegarde manuelle.");
    if(typeof cloud !== 'undefined') cloud.push();
}

// --- PLAYERS ---
function renderPlayersList() {
    const c = document.getElementById('playersListContainer');
    if(!c) return;
    c.innerHTML = "";
    (gameData.players || []).forEach(p => {
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.onclick = () => loadPlayer(p.id);
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <img src="${p.img || 'https://via.placeholder.com/50'}" class="avatar-circle">
                <div><b>${p.name}</b><br><small style="color:var(--accent)">${p.gold} Or</small></div>
            </div>
            <button class="btn-qr" onclick="event.stopPropagation();genQR(${p.id})">📱</button>`;
        c.appendChild(div);
    });
}

function newPlayerForm() {
    editingType = 'player';
    document.getElementById('pId').value = "";
    ['pName','pImg','pRegion','pTextInv'].forEach(i => document.getElementById(i).value = "");
    ['pGold','pElixir','pDark'].forEach(i => document.getElementById(i).value = 0);
    currentDeck = [];
    renderCurrentDeck('pDeckContainer');
}

function loadPlayer(id) {
    editingType = 'player';
    const p = gameData.players.find(x => x.id == id);
    if(!p) return;
    document.getElementById('pId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pImg').value = p.img;
    document.getElementById('pRegion').value = p.region;
    document.getElementById('pGold').value = p.gold;
    document.getElementById('pElixir').value = p.elixir;
    document.getElementById('pTextInv').value = p.inv;
    document.getElementById('pDark').value = p.dark || 0;
    currentDeck = p.deck ? [...p.deck] : [];
    renderCurrentDeck('pDeckContainer');
}

function savePlayer() {
    const id = document.getElementById('pId').value;
    const p = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('pName').value,
        img: document.getElementById('pImg').value,
        region: document.getElementById('pRegion').value,
        inv: document.getElementById('pTextInv').value,
        deck: currentDeck,
        gold: parseInt(document.getElementById('pGold').value) || 0,
        elixir: parseInt(document.getElementById('pElixir').value) || 0,
        dark: parseInt(document.getElementById('pDark').value) || 0
    };
    const i = gameData.players.findIndex(x => x.id == p.id);
    if (i >= 0) gameData.players[i] = p;
    else { gameData.players.push(p); ui.addLog("Nouveau Seigneur: " + p.name); }
    cloud.push();
    refreshGameData();
}

function deleteEntity(type) {
    if (confirm('Supprimer ?')) {
        const id = document.getElementById(type === 'players' ? 'pId' : 'nId').value;
        gameData[type] = gameData[type].filter(x => x.id != id);
        cloud.push();
        refreshGameData();
        if(type === 'players') newPlayerForm(); else newNPCForm();
    }
}

// --- NPCS ---
function renderNPCsList() {
    const c = document.getElementById('npcsListContainer');
    if(!c) return;
    c.innerHTML = "";
    (gameData.npcs || []).forEach(n => {
        const div = document.createElement('div');
        div.className = 'list-card-item npc';
        div.onclick = () => loadNPC(n.id);
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <img src="${n.img || 'https://via.placeholder.com/50'}" class="avatar-circle" style="border-color:var(--npc-color)">
                <div><b>${n.name}</b><br><small style="color:#aaa">${n.type}</small></div>
            </div>`;
        c.appendChild(div);
    });
}

function newNPCForm() {
    editingType = 'npc';
    document.getElementById('nId').value = "";
    ['nName', 'nType', 'nImg', 'nStory'].forEach(i => document.getElementById(i).value = "");
    if(document.getElementById('nGold')) document.getElementById('nGold').value=0;
    if(document.getElementById('nElixir')) document.getElementById('nElixir').value=0;
    if(document.getElementById('nDark')) document.getElementById('nDark').value=0;
    currentDeck = [];
    renderCurrentDeck('nDeckContainer');
}

function loadNPC(id) {
    editingType = 'npc';
    const n = gameData.npcs.find(x => x.id == id);
    if(!n) return;
    document.getElementById('nId').value = n.id;
    document.getElementById('nName').value = n.name;
    document.getElementById('nType').value = n.type;
    document.getElementById('nImg').value = n.img;
    document.getElementById('nStory').value = n.story;
    if(document.getElementById('nGold')) document.getElementById('nGold').value = n.gold || 0;
    if(document.getElementById('nElixir')) document.getElementById('nElixir').value = n.elixir || 0;
    if(document.getElementById('nDark')) document.getElementById('nDark').value = n.dark || 0;
    currentDeck = n.deck ? [...n.deck] : [];
    renderCurrentDeck('nDeckContainer');
}

function saveNPC() {
    const id = document.getElementById('nId').value;
    const n = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('nName').value,
        type: document.getElementById('nType').value,
        img: document.getElementById('nImg').value,
        story: document.getElementById('nStory').value,
        gold: parseInt(document.getElementById('nGold')?.value) || 0,
        elixir: parseInt(document.getElementById('nElixir')?.value) || 0,
        dark: parseInt(document.getElementById('nDark')?.value) || 0,
        deck: currentDeck
    };
    const i = gameData.npcs.findIndex(x => x.id == n.id);
    if (i >= 0) gameData.npcs[i] = n;
    else { gameData.npcs.push(n); ui.addLog("Nouveau PNJ: " + n.name); }
    cloud.push();
    refreshGameData();
}

// --- CARDS ---
function renderCurrentDeck(divId) {
    const c = document.getElementById(divId); 
    if(!c) return;
    c.innerHTML = "";
    currentDeck.forEach((cid, idx) => {
        const card = gameData.cards.find(x => x.id === cid) || { name: '?', img: '' };
        const tooltip = `<div class="card-tooltip"><div class="tooltip-header">${card.name}</div><div class="tooltip-stats"><span>💧 ${card.elixir}</span></div><div class="tooltip-desc">${card.desc || ""}</div></div>`;
        c.innerHTML += `<div class="cr-card-mini" style="overflow:visible;"><img src="${card.img}"><div class="remove-card-btn" onclick="removeCard(${idx},'${divId}')">x</div>${tooltip}</div>`;
    });
}

function removeCard(idx, divId) {
    currentDeck.splice(idx, 1);
    renderCurrentDeck(divId);
}

function openCardSelectionModal(type) {
    editingType = type;
    const g = document.getElementById('cardsGrid');
    if(!g) return;
    g.innerHTML = "";
    gameData.cards.forEach(c => {
        g.innerHTML += `<div class="grid-card"><img src="${c.img}" onclick="addCard('${c.id}')"><button class="card-edit-btn" onclick="editCustomCard('${c.id}')">✏️</button><br><small>${c.name}</small></div>`;
    });
    document.getElementById('cardSelectionModal').style.display = 'flex';
}

function addCard(id) {
    currentDeck.push(id);
    renderCurrentDeck(editingType === 'player' ? 'pDeckContainer' : 'nDeckContainer');
    document.getElementById('cardSelectionModal').style.display = 'none';
}

function newCustomCard() {
    document.getElementById('ccId').value = "";
    ['ccName','ccImg','ccElixir','ccDesc'].forEach(i => document.getElementById(i).value = "");
    document.getElementById('btnDeleteCard').style.display = 'none';
    document.getElementById('createCardModal').style.display = 'flex';
}

function editCustomCard(id) {
    const c = gameData.cards.find(x => x.id === id);
    if(!c) return;
    document.getElementById('ccId').value = c.id;
    document.getElementById('ccName').value = c.name;
    document.getElementById('ccImg').value = c.img;
    document.getElementById('ccElixir').value = c.elixir;
    document.getElementById('ccType').value = c.type || "Troupe";
    document.getElementById('ccDesc').value = c.desc || "";
    document.getElementById('btnDeleteCard').style.display = 'block';
    document.getElementById('createCardModal').style.display = 'flex';
}

function saveCustomCard() {
    const id = document.getElementById('ccId').value;
    const name = document.getElementById('ccName').value;
    if(!name) return alert("Nom requis");
    
    const card = {
        id: id || 'cust-'+Date.now(),
        name: name,
        img: document.getElementById('ccImg').value || 'https://via.placeholder.com/100',
        elixir: document.getElementById('ccElixir').value,
        desc: document.getElementById('ccDesc').value,
        type: document.getElementById('ccType').value
    };
    
    if(id) {
        const i = gameData.cards.findIndex(x => x.id === id);
        if(i>=0) gameData.cards[i] = card;
    } else {
        gameData.cards.push(card);
    }
    cloud.push();
    document.getElementById('createCardModal').style.display = 'none';
    openCardSelectionModal(editingType);
}

function deleteCustomCard() {
    if(!confirm("Supprimer ?")) return;
    const id = document.getElementById('ccId').value;
    gameData.cards = gameData.cards.filter(x => x.id !== id);
    cloud.push();
    document.getElementById('createCardModal').style.display = 'none';
    openCardSelectionModal(editingType);
}

// --- RELATIONS ---
function renderRelationSubjects() {
    const c = document.getElementById('relSubjectList');
    if(!c) return;
    c.innerHTML = "";
    selectedRelationSubject = null;
    document.getElementById('relTitle').innerText = "Sélectionnez...";
    document.getElementById('relContainer').innerHTML = "";
    
    [...gameData.players, ...gameData.npcs].forEach(e => {
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.onclick = () => loadRelationsFor(e.id, e.name);
        div.innerHTML = `<b>${e.name}</b>`;
        c.appendChild(div);
    });
}

function loadRelationsFor(id, name) {
    selectedRelationSubject = id;
    document.getElementById('relTitle').innerText = "Relations de " + name;
    const c = document.getElementById('relContainer');
    c.innerHTML = "";
    
    [...gameData.players, ...gameData.npcs].forEach(t => {
        if (t.id == id) return;
        const r = gameData.relations.find(x => x.from == id && x.to == t.id) || { status: 'Inconnu', note: '' };
        const statusCss = r.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        c.innerHTML += `
            <div class="relation-target" id="rel-row-${t.id}">
                <div class="rel-status-bar status-${statusCss}"></div>
                <b>${t.name}</b>
                <select onchange="updateRelWithVisual(${id},${t.id},'status',this)">
                    <option value="Inconnu" ${r.status=='Inconnu'?'selected':''}>Inconnu</option>
                    <option value="Amical" ${r.status=='Amical'?'selected':''}>Amical</option>
                    <option value="Neutre" ${r.status=='Neutre'?'selected':''}>Neutre</option>
                    <option value="Hostile" ${r.status=='Hostile'?'selected':''}>Hostile</option>
                    <option value="Allié" ${r.status=='Allié'?'selected':''}>Allié</option>
                </select>
                <input type="text" value="${r.note}" placeholder="Notes..." onchange="updateRel(${id},${t.id},'note',this.value)">
            </div>`;
    });
}

function updateRelWithVisual(from, to, field, selectElement) {
    const val = selectElement.value;
    updateRel(from, to, field, val);
    const row = document.getElementById(`rel-row-${to}`);
    const bar = row.querySelector('.rel-status-bar');
    if(bar) {
        const statusCss = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        bar.className = `rel-status-bar status-${statusCss}`;
    }
}

function updateRel(from, to, field, val) {
    let r = gameData.relations.find(x => x.from == from && x.to == to);
    if (!r) {
        r = { from: from, to: to, status: 'Inconnu', note: '' };
        gameData.relations.push(r);
    }
    r[field] = val;
    cloud.push();
}

// --- JOURNAL ---
function renderJournalList() {
    const c = document.getElementById('journalListContainer');
    if(!c) return;
    c.innerHTML = "";
    (gameData.journal || []).sort((a, b) => b.id - a.id).forEach(j => {
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.onclick = () => loadJournal(j.id);
        div.innerHTML = `<div class="journal-date" style="font-size:0.8em;color:#aaa">${j.date}</div><b style="margin-left:5px">${j.title}</b>`;
        c.appendChild(div);
    });
}

function loadJournal(id) {
    const j = gameData.journal.find(x => x.id == id);
    if(!j) return;
    document.getElementById('jId').value = j.id;
    document.getElementById('jTitle').value = j.title;
    document.getElementById('jDate').value = j.date;
    document.getElementById('jContent').value = j.content;
    
    const parts = j.parts || [];
    if(document.getElementById('jParticipantsData')) {
        document.getElementById('jParticipantsData').value = JSON.stringify(parts);
        renderPreview('jParticipantsPreview', parts);
    }
}

function newJournalForm() {
    ['jId', 'jTitle', 'jDate', 'jContent'].forEach(i => document.getElementById(i).value = "");
    if(document.getElementById('jParticipantsData')) {
        document.getElementById('jParticipantsData').value = "[]";
        renderPreview('jParticipantsPreview', []);
    }
}

function saveJournal() {
    const id = document.getElementById('jId').value;
    const rawParts = document.getElementById('jParticipantsData').value;
    const parts = rawParts ? JSON.parse(rawParts) : [];
    
    const j = {
        id: id ? parseInt(id) : Date.now(),
        title: document.getElementById('jTitle').value,
        date: document.getElementById('jDate').value,
        content: document.getElementById('jContent').value,
        parts: parts
    };
    
    const i = gameData.journal.findIndex(x => x.id == j.id);
    if (i >= 0) gameData.journal[i] = j;
    else gameData.journal.push(j);
    
    cloud.push();
    renderJournalList();
}

// --- PARTICIPANTS ---
function openParticipantModal(context) {
    currentParticipantContext = context;
    const list = document.getElementById('participantListCheckboxes');
    list.innerHTML = "";

    const inputId = context === 'journal' ? 'jParticipantsData' : 'qParticipantsData';
    const rawVal = document.getElementById(inputId).value;
    let selectedIds = [];
    try { selectedIds = JSON.parse(rawVal); } catch(e) { selectedIds = []; }

    const allActors = [...(gameData.players || []), ...(gameData.npcs || [])];

    allActors.forEach(p => {
        const isChecked = selectedIds.includes(p.id) ? 'checked' : '';
        list.innerHTML += `
            <label style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; display:flex; align-items:center; cursor:pointer; border:1px solid #555; margin-bottom:5px;">
                <input type="checkbox" value="${p.id}" ${isChecked} style="width:auto; margin:0 10px 0 0;">
                <img src="${p.img || 'https://via.placeholder.com/30'}" style="width:30px; height:30px; border-radius:50%; margin-right:10px; object-fit:cover;">
                <span style="font-weight:bold; color:white;">${p.name}</span>
                <small style="margin-left:auto; color:#aaa;">${p.type || 'Joueur'}</small>
            </label>`;
    });

    document.getElementById('participantModal').style.display = 'flex';
}

function confirmParticipants() {
    const checkboxes = document.querySelectorAll('#participantListCheckboxes input:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (currentParticipantContext === 'journal') {
        document.getElementById('jParticipantsData').value = JSON.stringify(selectedIds);
        renderPreview('jParticipantsPreview', selectedIds);
    } else {
        document.getElementById('qParticipantsData').value = JSON.stringify(selectedIds);
        renderPreview('qParticipantsPreview', selectedIds);
    }
    document.getElementById('participantModal').style.display = 'none';
}

function renderPreview(containerId, ids) {
    const c = document.getElementById(containerId);
    if(!c) return;
    c.innerHTML = "";
    
    if(!ids || ids.length === 0) {
        c.innerHTML = "<small style='color:#666; font-style:italic;'>Aucun</small>";
        return;
    }

    const allActors = [...(gameData.players || []), ...(gameData.npcs || [])];
    ids.forEach(id => {
        const actor = allActors.find(a => a.id === id);
        if (actor) {
            c.innerHTML += `
                <div class="participant-badge" style="background:#2c3e50; border:1px solid #4a86c7; color:white; padding:2px 8px; border-radius:12px; font-size:0.85em; display:flex; align-items:center; gap:5px; margin-right:5px; margin-bottom:5px;">
                    <img src="${actor.img}" style="width:20px; height:20px; border-radius:50%;"> 
                    ${actor.name}
                </div>`;
        }
    });
}

// --- QUETES ---
function renderQuestList() {
    const c = document.getElementById('questListContainer');
    if(!c) return;
    c.innerHTML = "";
    (gameData.quests || []).forEach(q => {
        let color = '#fff';
        if(q.status === 'Terminée') color = '#2ecc71';
        else if(q.status === 'Échouée') color = '#e74c3c';
        
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.onclick = () => loadQuest(q.id);
        div.innerHTML = `
            <div style="width:100%">
                <div style="display:flex; justify-content:space-between;">
                    <b>${q.title}</b>
                    <span style="font-size:0.8em; color:${color}">${q.status}</span>
                </div>
                <div style="font-size:0.8em; color:#aaa;">Donneur: ${getGiverName(q.giver)}</div>
            </div>`;
        c.appendChild(div);
    });
}

function getGiverName(id) {
    const npc = (gameData.npcs || []).find(n => n.id == id);
    return npc ? npc.name : "Inconnu/Autre";
}

function updateGiverSelect(selectedId = "") {
    const sel = document.getElementById('qGiver');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Inconnu / Panneau --</option>';
    (gameData.npcs || []).forEach(n => {
        const selected = n.id == selectedId ? 'selected' : '';
        sel.innerHTML += `<option value="${n.id}" ${selected}>${n.name} (${n.type})</option>`;
    });
}

function newQuestForm() {
    if(document.getElementById('qId')) document.getElementById('qId').value = "";
    if(document.getElementById('qTitle')) document.getElementById('qTitle').value = "";
    if(document.getElementById('qDesc')) document.getElementById('qDesc').value = "";
    if(document.getElementById('qRewards')) document.getElementById('qRewards').value = "";
    if(document.getElementById('qStatus')) document.getElementById('qStatus').value = "En cours";
    updateGiverSelect();
    if(document.getElementById('qParticipantsData')) {
        document.getElementById('qParticipantsData').value = "[]";
        renderPreview('qParticipantsPreview', []);
    }
}

function loadQuest(id) {
    const q = gameData.quests.find(x => x.id == id);
    if(!q) return;
    document.getElementById('qId').value = q.id;
    document.getElementById('qTitle').value = q.title;
    document.getElementById('qDesc').value = q.desc;
    document.getElementById('qRewards').value = q.rewards;
    document.getElementById('qStatus').value = q.status;
    updateGiverSelect(q.giver);
    const assigned = q.assignedTo || [];
    document.getElementById('qParticipantsData').value = JSON.stringify(assigned);
    renderPreview('qParticipantsPreview', assigned);
}

function saveQuest() {
    const id = document.getElementById('qId').value;
    const rawAssigned = document.getElementById('qParticipantsData').value;
    const assigned = rawAssigned ? JSON.parse(rawAssigned) : [];
    const q = {
        id: id ? parseInt(id) : Date.now(),
        title: document.getElementById('qTitle').value || "Nouvelle Quête",
        giver: document.getElementById('qGiver').value,
        status: document.getElementById('qStatus').value,
        desc: document.getElementById('qDesc').value,
        rewards: document.getElementById('qRewards').value,
        assignedTo: assigned
    };
    gameData.quests = gameData.quests || [];
    const idx = gameData.quests.findIndex(x => x.id == q.id);
    if(idx >= 0) gameData.quests[idx] = q;
    else {
        gameData.quests.push(q);
        ui.addLog("Nouvelle quête : " + q.title);
    }
    cloud.push();
    renderQuestList();
}

function deleteQuest() {
    const id = document.getElementById('qId').value;
    if(id && confirm("Supprimer cette quête ?")) {
        gameData.quests = gameData.quests.filter(x => x.id != id);
        cloud.push();
        renderQuestList();
        newQuestForm();
    }
}

function renderMobileQuests(playerId) {
    const c = document.getElementById('mobQuestList');
    if(!c) return;
    c.innerHTML = "";
    const myQuests = (gameData.quests || []).filter(q => 
        (q.assignedTo || []).includes(playerId) && q.status !== 'Cachée'
    );
    if(myQuests.length === 0) {
        c.innerHTML = "<div style='text-align:center; color:#888; margin-top:20px;'>Aucune quête active.</div>";
        return;
    }
    myQuests.forEach(q => {
        let icon = "⚔️";
        let styleClass = "";
        if(q.status === 'Terminée') { icon = "✅"; styleClass="opacity:0.7;"; }
        if(q.status === 'Échouée') { icon = "❌"; styleClass="opacity:0.7;"; }
        c.innerHTML += `
        <div class="mob-card" style="text-align:left; ${styleClass}">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">
                <b style="color:var(--accent); font-size:1.1em;">${icon} ${q.title}</b>
                <span style="font-size:0.8em; background:#333; color:white; padding:2px 6px; border-radius:4px;">${q.status}</span>
            </div>
            <div style="font-size:0.9em; color:#333; font-style:italic; margin-bottom:10px;">${q.desc}</div>
            <div style="font-size:0.8em; display:flex; justify-content:space-between;">
                <span>👤 ${getGiverName(q.giver)}</span>
                <span style="color:#e67e22; font-weight:bold;">🎁 ${q.rewards || "???"}</span>
            </div>
        </div>`;
    });
}

// --- MAP (Suite) ---
const mapManager = {
    renderList: () => {
        const c = document.getElementById('mapListContainer'); if(!c) return; c.innerHTML = "";
        gameData.maps = gameData.maps || [{ id: 'root', name: 'Monde Principal', img: 'map.png' }];
        const current = gameData.maps.find(x => x.id === gameData.activeMapId) || gameData.maps[0];
        
        gameData.maps.forEach(m => {
            const div = document.createElement('div');
            div.className = `map-item ${gameData.activeMapId === m.id ? 'active' : ''}`;
            div.innerHTML = `🗺️ <b>${m.name}</b>`; 
            div.onclick = () => mapManager.switchMap(m.id);
            c.appendChild(div);
        });

        const imgDesktop = document.getElementById('worldMapImg');
        const imgMobile = document.querySelector('#mob-map .world-map');
        const label = document.getElementById('currentMapLabel');

        if(imgDesktop) imgDesktop.src = current.img;
        if(imgMobile) imgMobile.src = current.img;
        if(label) label.innerText = current.name;
        
        const inputUrl = document.getElementById('editMapUrl');
        if(inputUrl && document.activeElement !== inputUrl) inputUrl.value = current.img;
    },
    switchMap: (id) => { gameData.activeMapId = id; cloud.push(); refreshGameData(); },
    addMap: () => {
        const name = document.getElementById('newMapName').value;
        if(name) {
            const id = 'map-' + Date.now();
            gameData.maps.push({ id: id, name: name, img: 'map.png' });
            document.getElementById('newMapName').value = "";
            mapManager.switchMap(id);
        }
    },
    updateUrl: () => {
        const url = document.getElementById('editMapUrl').value;
        const current = gameData.maps.find(x => x.id === gameData.activeMapId);
        if(current && url) { current.img = url; cloud.push(); refreshGameData(); }
    }
};

// --- UTILS ---
function renderLogs() { 
    const c=document.getElementById('logOutput'); c.innerHTML=""; 
    (gameData.logs||[]).slice().forEach(l=>{c.innerHTML+=`<div class="log-entry"><span class="log-time">[${l.t}]</span> ${l.m}</div>`;}); 
}
function addManualLog() { 
    const i=document.getElementById('customLogInput'); 
    if(i.value){ui.addLog(i.value); i.value=""; cloud.push(); refreshGameData();} 
}
function clearLogs() { if(confirm('Vider ?')){gameData.logs=[]; cloud.push(); refreshGameData();} }
function genQR(id) { 
    const u=localStorage.getItem('sb_url'), k=localStorage.getItem('sb_key'); 
    if(!u) return alert("Config requise"); 
    const l=`${window.location.href.split('?')[0]}?mode=client&s=${gameData.sessionId}&id=${id}&u=${encodeURIComponent(btoa(u))}&k=${encodeURIComponent(btoa(k))}`; 
    document.getElementById('qrcode').innerHTML=""; 
    new QRCode(document.getElementById("qrcode"),{text:l,width:200,height:200}); 
    document.getElementById('qrModal').style.display='flex'; 
}
function loadGmChat(id, name) { currentGmChannel = id; document.getElementById('gmChatTitle').innerText = name || "Global (Public)"; refreshGameData(); }
function sendChatMessage(source) {
    let text, fromId, toId, senderName;
    if(source === 'mobile') {
        text = document.getElementById('mobChatInput').value;
        const params = new URLSearchParams(window.location.search); fromId = parseInt(params.get('id'));
        const p = gameData.players.find(x => x.id === fromId);
        if(!p || !text) return;
        senderName = p.name; toId = document.getElementById('mobChatTarget').value;
        document.getElementById('mobChatInput').value = "";
    } else {
        text = document.getElementById('gmChatInput').value; if(!text) return;
        fromId = 'gm'; senderName = 'MJ'; toId = currentGmChannel === 'global' ? 'global' : parseInt(currentGmChannel);
        document.getElementById('gmChatInput').value = "";
    }
    gameData.chat.push({ id: Date.now(), from: fromId, to: toId, name: senderName, text: text, time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) });
    if(gameData.chat.length > 100) gameData.chat.shift(); cloud.push(); refreshGameData();
}
function renderChat(containerId, viewerId) {
    const c = document.getElementById(containerId); c.innerHTML = "";
    const isGm = viewerId === 'gm'; const filterId = isGm ? currentGmChannel : viewerId;
    gameData.chat.forEach(msg => {
        let show = false, isPrivate = false;
        if(isGm) {
            if(filterId === 'global') { if(msg.to === 'global') show = true; }
            else { const tId = parseInt(filterId); if(msg.from === tId || msg.to === tId) { show = true; if(msg.to !== 'global') isPrivate = true; } }
        } else {
            if(msg.to === 'global') show = true; else if(msg.from === viewerId || msg.to == viewerId) { show = true; isPrivate = true; }
        }
        if(show) {
            const isMe = msg.from === viewerId; const align = isMe ? 'right' : 'left';
            let content = ``;
            if(isPrivate) {
                let label = "Privé";
                if(isGm && msg.to !== 'gm' && msg.from !== 'gm' && msg.from !== parseInt(filterId)) { const t = gameData.players.find(x=>x.id==msg.to); label = `à ${t?t.name:'?'}`; }
                content += `<span class="private-tag">🔒 ${label}</span>`;
            }
            content += `<b>${msg.name}</b><br>${msg.text}<div class="msg-meta">${msg.time}</div>`;
            c.innerHTML += `<div class="msg-bubble ${align} ${isPrivate?'private':''}">${content}</div>`;
        }
    });
    c.scrollTop = c.scrollHeight;
}
function playClashCardEffect(cardId) {
    const card = gameData.cards.find(c => c.id === cardId);
    const imgUrl = card ? card.img : 'https://via.placeholder.com/150?text=Carte';
    const cardName = card ? card.name : 'Nouvel Objet';
    const overlay = document.createElement('div'); overlay.id = 'cr-overlay'; overlay.onclick = function() { document.body.removeChild(overlay); };
    overlay.innerHTML = `<div class="cr-effect-container"><div class="cr-title-pop">NOUVELLE CARTE !</div><div class="cr-burst"></div><img src="${imgUrl}" class="cr-new-card-pop"><div class="cr-name-pop">${cardName}</div></div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { if (document.body.contains(overlay)) document.body.removeChild(overlay); }, 4000);
}

// --- INIT ---
if(typeof client !== 'undefined') {
    client.check();
    setTimeout(() => { if(typeof initMapInteraction === 'function') initMapInteraction(); }, 1000);
}
