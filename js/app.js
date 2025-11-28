// ============================================================
// FICHIER : js/app.js (VERSION V22 - FINAL FIX)
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
    // Sécurisation des données
    gameData.players = gameData.players || [];
    gameData.npcs = gameData.npcs || [];
    gameData.logs = gameData.logs || [];
    gameData.relations = gameData.relations || [];
    gameData.chat = gameData.chat || [];
    gameData.journal = gameData.journal || [];
    gameData.quests = gameData.quests || [];
    gameData.maps = gameData.maps || [{ id: 'root', name: 'Monde Principal', img: 'map.png' }];

    // Mise à jour Carte
    if(typeof mapManager !== 'undefined') mapManager.renderList();
    
    // C'est ici que ça plantait : on vérifie que la fonction existe avant de l'appeler
    if(typeof renderMapPins === 'function') {
        renderMapPins();
    } else {
        console.error("ERREUR CRITIQUE : renderMapPins n'est pas chargée !");
    }

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

            const currentDeck = p.deck || [];
            if (client.lastDeckState !== null) {
                const newCards = currentDeck.filter(cid => !client.lastDeckState.includes(cid));
                if (newCards.length > 0) playClashCardEffect(newCards[0]);
            }
            client.lastDeckState = [...currentDeck];

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
            
            const sel = document.getElementById('mobChatTarget');
            if(sel) {
                const curr = sel.value;
                sel.innerHTML = `<option value="global">Global</option><option value="gm">Au MJ</option>`;
                d.players.forEach(o => { if(o.id !== id) sel.innerHTML += `<option value="${o.id}">à ${o.name}</option>`; });
                sel.value = curr;
            }
            renderChat('mobChatFeed', id);

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

// ============================================================
// GESTION CARTE & PIONS (C'est ici que ça manquait !)
// ============================================================

function toggleMapMarkers() {
    showMarkers = !showMarkers;
    // On peut ajouter un log ou changer le texte du bouton si on veut
    renderMapPins();
}

function renderMapPins() {
    // 1. Nettoyage
    document.querySelectorAll('.map-marker').forEach(e => e.remove());

    // 2. Vérif affichage
    if(!showMarkers) return;

    // 3. Rendu
    const containers = [
        document.querySelector('#gmMapContainer'), 
        document.querySelector('#mob-map .full-map-container')
    ];

    containers.forEach(c => {
        if (c) {
            gameData.players.forEach(p => {
                const pMap = p.mapId || 'root';
                if (p.mapX && p.mapY && pMap === gameData.activeMapId) {
                    const d = document.createElement('div'); 
                    d.className = 'map-marker';
                    d.style.left = p.mapX + '%'; 
                    d.style.top = p.mapY + '%';
                    d.style.backgroundImage = `url('${p.img || "https://via.placeholder.com/50"}')`;
                    d.innerHTML = `<div class="tooltip">${p.name}</div>`;
                    
                    if (document.getElementById('gm-view').style.display !== 'none') {
                        d.onclick = (e) => { 
                            e.stopPropagation(); 
                            switchTab('view-players'); 
                            loadPlayer(p.id); 
                        };
                    }
                    c.appendChild(d);
                }
            });
        }
    });
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
    cloud.push
