function refreshGameData() {
    gameData.players = gameData.players || [];
    gameData.npcs = gameData.npcs || [];
    gameData.logs = gameData.logs || [];
    gameData.relations = gameData.relations || [];
    gameData.chat = gameData.chat || [];
    gameData.maps = gameData.maps || [{ id: 'root', name: 'Monde Principal', img: 'map.png' }];

    mapManager.renderList();
    renderMapPins();

    const params = new URLSearchParams(window.location.search);
    if(params.get('mode') === 'client') {
        client.render(gameData);
        const r = document.getElementById('mobRegion'); 
        const p = gameData.players.find(x => x.id === parseInt(params.get('id')));
        if(p && r.innerHTML.includes("reçues")) r.innerHTML = p.region || "-";
    } else {
        ui.refreshAll();
    }
}

// === CHAT ===
let currentGmChannel = 'global';
function sendChatMessage(source) {
    let text, fromId, toId, senderName;
    if(source === 'mobile') {
        text = document.getElementById('mobChatInput').value;
        const params = new URLSearchParams(window.location.search); 
        fromId = parseInt(params.get('id'));
        const p = gameData.players.find(x => x.id === fromId);
        if(!p || !text) return;
        senderName = p.name; 
        toId = document.getElementById('mobChatTarget').value;
        document.getElementById('mobChatInput').value = "";
    } else {
        text = document.getElementById('gmChatInput').value; 
        if(!text) return;
        fromId = 'gm'; 
        senderName = 'MJ'; 
        toId = currentGmChannel === 'global' ? 'global' : parseInt(currentGmChannel);
        document.getElementById('gmChatInput').value = "";
    }
    gameData.chat.push({ 
        id: Date.now(), from: fromId, to: toId, name: senderName, text: text, 
        time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) 
    });
    if(gameData.chat.length > 100) gameData.chat.shift(); 
    cloud.push(); 
    refreshGameData();
}

function renderChat(containerId, viewerId) {
    const c = document.getElementById(containerId); c.innerHTML = "";
    const isGm = viewerId === 'gm'; const filterId = isGm ? currentGmChannel : viewerId;
    gameData.chat.forEach(msg => {
        let show = false;
        let isPrivate = false;
        if(isGm) {
            if(filterId === 'global') { 
                if(msg.to === 'global') show = true; 
            } else { 
                const tId = parseInt(filterId); 
                if(msg.from === tId || msg.to === tId) { show = true; if(msg.to !== 'global') isPrivate = true; } 
            }
        } else {
            if(msg.to === 'global') show = true; 
            else if(msg.from === viewerId || msg.to == viewerId) { show = true; isPrivate = true; }
        }
        if(show) {
            const isMe = msg.from === viewerId; const align = isMe ? 'right' : 'left';
            let content = ``;
            if(isPrivate) {
                let label = "Privé";
                if(isGm && msg.to !== 'gm' && msg.from !== 'gm' && msg.from !== parseInt(filterId)) { 
                    const t = gameData.players.find(x=>x.id==msg.to); label = `à ${t?t.name:'?'}`; 
                }
                content += `<span class="private-tag">🔒 ${label}</span>`;
            }
            content += `<b>${msg.name}</b><br>${msg.text}<div class="msg-meta">${msg.time}</div>`;
            
            const bubble = document.createElement('div');
            bubble.className = `msg-bubble ${align} ${isPrivate?'private':''}`;
            bubble.innerHTML = content;
            c.appendChild(bubble);
        }
    });
    c.scrollTop = c.scrollHeight;
}

// === CLIENT MOBILE (AUTOMATISÉ) ===
const client = {
    // Mémoire locale pour détecter les changements
    lastDeckState: null, 

    check: () => {
        const params = new URLSearchParams(window.location.search);
        if(params.get('mode') === 'client') {
            document.getElementById('gm-view').style.display = 'none'; 
            document.getElementById('client-view').style.display = 'flex'; 
            document.title = "Jeu en cours";
            try {
                let u = atob(params.get('u')), k = atob(params.get('k'));
                localStorage.setItem('sb_url', u); localStorage.setItem('sb_key', k); 
                gameData.sessionId = params.get('s'); cloud.init();
            } catch(e) { document.getElementById('mobName').innerText = "ERREUR LIEN"; }
        } else cloud.init();
    },

    render: (d) => {
        const id = parseInt(new URLSearchParams(window.location.search).get('id'));
        const p = d.players.find(x => x.id === id);
        
        if(p) {
            // 1. MISE À JOUR DES TEXTES (Classique)
            document.getElementById('mobName').innerText = p.name;
            document.getElementById('mobImg').src = p.img || "https://via.placeholder.com/150";
            
            const regionEl = document.getElementById('mobRegion');
            if(!regionEl.innerHTML.includes("Erreur")) regionEl.innerText = p.region || "Inconnu";
            
            document.getElementById('mobGold').innerText = p.gold; 
            document.getElementById('mobElixir').innerText = p.elixir;
            document.getElementById('mobInv').innerText = p.inv || "";
            
            // 2. DÉTECTION DE NOUVELLE CARTE (Le Cerveau)
            const currentDeck = p.deck || [];
            
            // Si on a déjà un état précédent en mémoire (ce n'est pas le chargement de la page)
            if (client.lastDeckState !== null) {
                // On regarde s'il y a une différence
                const newCards = currentDeck.filter(cardId => !client.lastDeckState.includes(cardId));
                
                // S'il y a des nouvelles cartes, on lance l'effet pour la première trouvée
                if (newCards.length > 0) {
                    console.log("Nouvelle carte détectée !", newCards[0]);
                    playClashCardEffect(newCards[0]);
                }
            }

            // On met à jour la mémoire pour la prochaine fois
            client.lastDeckState = [...currentDeck];

            // 3. AFFICHAGE DU DECK
            const md = document.getElementById('mobDeckDisplay'); md.innerHTML = "";
            if(currentDeck.length > 0) {
                currentDeck.forEach(cid => { 
                    const c = gameData.cards.find(x => x.id == cid); 
                    if(c) md.innerHTML += `<img src="${c.img}" style="width:40px; height:50px; object-fit:contain;">`; 
                });
            } else md.innerHTML = "<small style='color:#555'>Aucune carte</small>";
            
            // 4. MISE À JOUR CHAT & JOURNAL
            const sel = document.getElementById('mobChatTarget');
            const curr = sel.value;
            sel.innerHTML = `<option value="global">Global</option><option value="gm">Au MJ</option>`;
            d.players.forEach(o => { if(o.id !== id) sel.innerHTML += `<option value="${o.id}">à ${o.name}</option>`; });
            sel.value = curr; 
            
            renderChat('mobChatFeed', id);

            const jCont = document.getElementById('mobJournalList'); jCont.innerHTML = "";
            (d.journal || []).sort((a,b)=>b.id-a.id).forEach(j => {
                jCont.innerHTML += `
                    <div class="mob-journal-entry">
                        <div class="mob-journal-date">${j.date}</div>
                        <div class="mob-journal-title">${j.title}</div>
                        <div class="mob-journal-content">${j.content}</div>
                    </div>`;
            });
        }
    },

    switchTab: (t) => {
        document.querySelectorAll('.mob-container').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.mob-tab-btn').forEach(e => e.classList.remove('active'));
        document.getElementById('mob-'+t).classList.add('active'); 
        document.getElementById('tab-'+t).classList.add('active');
    }
};

// === MJ ===
let currentDeck = [], editingType = 'player', selectedRelationSubject = null;
const ui = {
    refreshAll: () => {
        if(document.getElementById('gm-view').style.display === 'none') return;
        renderPlayersList(); renderNPCsList(); renderJournalList(); renderLogs();
        if(selectedRelationSubject) loadRelationsFor(selectedRelationSubject); 
        else renderRelationSubjects();
        
        const cc = document.getElementById('gmChatChannels'); cc.innerHTML = "";
        gameData.players.forEach(p => { 
            const active = parseInt(currentGmChannel) === p.id ? 'selected' : '';
            cc.innerHTML += `<div class="list-card-item ${active}" onclick="loadGmChat(${p.id}, '${p.name}')"><img src="${p.img}" class="avatar-circle"><b>${p.name}</b></div>`; 
        });
        document.getElementById('chan-global').className = `list-card-item ${currentGmChannel==='global'?'selected':''}`;
        renderChat('gmChatFeed', 'gm');
    },
    showToast: () => { 
        const t = document.getElementById('toast'); t.style.display='block'; 
        setTimeout(()=>t.style.display='none', 2000); 
    },
    addLog: (msg) => { 
        const t = new Date().toLocaleTimeString('fr-FR'); 
        gameData.logs.push({ t: t, m: msg }); 
        if(gameData.logs.length > 50) gameData.logs.shift(); 
    }
};

function switchTab(t){
    document.querySelectorAll('.view-section').forEach(e=>e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
    document.getElementById(t).classList.add('active');
    const map = {'view-map':0, 'view-chat':1, 'view-players':2, 'view-npcs':3, 'view-relations':4, 'view-journal':5, 'view-logs':6};
    const btn = document.querySelectorAll('#gm-view .nav-tabs .tab-btn')[map[t]]; 
    if(btn) btn.classList.add('active');
    if(t === 'view-relations') renderRelationSubjects();
}
function saveData(notify=false) { if(notify) ui.addLog("Sauvegarde manuelle."); cloud.push(); }
function loadGmChat(id, name) { currentGmChannel = id; document.getElementById('gmChatTitle').innerText = name || "Global (Public)"; refreshGameData(); }

// --- PLAYERS ---
function renderPlayersList() { 
    const c=document.getElementById('playersListContainer');
    c.innerHTML=""; 
    (gameData.players||[]).forEach(p=>{ 
        const d = document.createElement('div'); 
        d.className='list-card-item'; 
        d.onclick = () => loadPlayer(p.id);
        d.innerHTML=`<div style="display:flex;align-items:center;gap:10px;"><img src="${p.img||'https://via.placeholder.com/50'}" class="avatar-circle"><div><b>${p.name}</b><br><small style="color:var(--accent)">${p.gold} Or</small></div></div><button class="btn-qr" onclick="event.stopPropagation();genQR(${p.id})">📱</button>`; 
        c.appendChild(d); 
    }); 
}

function newPlayerForm() { 
    editingType='player'; 
    document.getElementById('pId').value=""; 
    ['pName','pImg','pRegion','pTextInv'].forEach(i=>document.getElementById(i).value=""); 
    ['pGold','pElixir','pDark'].forEach(i=>document.getElementById(i).value=0); 
    currentDeck=[]; 
    renderCurrentDeck('pDeckContainer'); 
}

function loadPlayer(id) { 
    editingType='player'; 
    const p=gameData.players.find(x=>x.id==id); 
    document.getElementById('pId').value=p.id; 
    document.getElementById('pName').value=p.name; 
    document.getElementById('pImg').value=p.img; 
    document.getElementById('pRegion').value=p.region; 
    document.getElementById('pGold').value=p.gold; 
    document.getElementById('pElixir').value=p.elixir; 
    document.getElementById('pTextInv').value=p.inv; 
    document.getElementById('pDark').value=p.dark || 0; 
    currentDeck=p.deck?[...p.deck]:[]; 
    renderCurrentDeck('pDeckContainer'); 
}

function savePlayer() { 
    const id=document.getElementById('pId').value; 
    const p={
        id:id?parseInt(id):Date.now(), 
        name:document.getElementById('pName').value, 
        img:document.getElementById('pImg').value, 
        region:document.getElementById('pRegion').value, 
        inv:document.getElementById('pTextInv').value, 
        deck:currentDeck, 
        gold:parseInt(document.getElementById('pGold').value), 
        elixir:parseInt(document.getElementById('pElixir').value), 
        dark:parseInt(document.getElementById('pDark').value)
    }; 
    const i=gameData.players.findIndex(x=>x.id==p.id); 
    if(i>=0) gameData.players[i]=p; 
    else {gameData.players.push(p); ui.addLog("Nouveau Seigneur: "+p.name);} 
    cloud.push(); 
    refreshGameData(); 
}

// --- NPCS ---
function renderNPCsList() { 
    const c=document.getElementById('npcsListContainer'); c.innerHTML=""; 
    (gameData.npcs||[]).forEach(n=>{ 
        const d = document.createElement('div'); 
        d.className='list-card-item npc'; 
        d.onclick = () => loadNPC(n.id);
        d.innerHTML=`<div style="display:flex;align-items:center;gap:10px;"><img src="${n.img||'https://via.placeholder.com/50'}" class="avatar-circle" style="border-color:var(--npc-color)"><div><b>${n.name}</b><br><small style="color:#aaa">${n.type}</small></div></div>`; 
        c.appendChild(d);
    }); 
}

function newNPCForm() { 
    editingType='npc'; 
    document.getElementById('nId').value=""; 
    ['nName','nType','nImg','nStory'].forEach(i=>document.getElementById(i).value=""); 
    currentDeck=[]; 
    renderCurrentDeck('nDeckContainer'); 
}

function loadNPC(id) { 
    editingType='npc'; 
    const n=gameData.npcs.find(x=>x.id==id); 
    document.getElementById('nId').value=n.id; 
    document.getElementById('nName').value=n.name; 
    document.getElementById('nType').value=n.type; 
    document.getElementById('nImg').value=n.img; 
    document.getElementById('nStory').value=n.story; 
    currentDeck=n.deck?[...n.deck]:[]; 
    renderCurrentDeck('nDeckContainer'); 
}

function saveNPC() { 
    const id=document.getElementById('nId').value; 
    const n={
        id:id?parseInt(id):Date.now(), 
        name:document.getElementById('nName').value, 
        type:document.getElementById('nType').value, 
        img:document.getElementById('nImg').value, 
        story:document.getElementById('nStory').value, 
        deck:currentDeck
    }; 
    const i=gameData.npcs.findIndex(x=>x.id==n.id); 
    if(i>=0) gameData.npcs[i]=n; 
    else {gameData.npcs.push(n); ui.addLog("Nouveau PNJ: "+n.name);} 
    cloud.push(); 
    refreshGameData(); 
}

function deleteEntity(type) { 
    if(confirm('Supprimer ?')) { 
        const id=document.getElementById(type==='players'?'pId':'nId').value; 
        gameData[type]=gameData[type].filter(x=>x.id!=id); 
        cloud.push(); 
        refreshGameData(); 
    } 
}

// --- CARDS ---
function renderCurrentDeck(divId) { 
    const c=document.getElementById(divId); c.innerHTML=""; 
    currentDeck.forEach((cid, idx)=>{ 
        const card=gameData.cards.find(x=>x.id===cid)||{img:''}; 
        
        // Tooltip logic
        const tooltipHtml = `
            <div class="card-tooltip">
                <div class="tooltip-header">${card.name}</div>
                <div class="tooltip-stats">
                    <span>💧 ${card.elixir}</span>
                    <span>⚔️ ${card.type || 'Autre'}</span>
                </div>
                <div class="tooltip-desc">${card.desc || "Aucune description disponible."}</div>
            </div>
        `;

        c.innerHTML+=`
        <div class="cr-card-mini" style="overflow:visible;">
            <img src="${card.img}">
            <div class="remove-card-btn" onclick="removeCard(${idx},'${divId}')">x</div>
            ${tooltipHtml}
        </div>`; 
    }); 
}

function removeCard(idx, divId) { 
    currentDeck.splice(idx,1); 
    renderCurrentDeck(divId); 
}

// === CARD EDITING ===
function openCardSelectionModal(type) { 
    editingType=type; 
    const g=document.getElementById('cardsGrid'); g.innerHTML=""; 
    gameData.cards.forEach(c=>{ 
        g.innerHTML+=`
        <div class="grid-card">
            <img src="${c.img}" onclick="addCard('${c.id}')">
            <button class="card-edit-btn" onclick="editCustomCard('${c.id}')">✏️</button>
            <br><small>${c.name}</small>
        </div>`; 
    }); 
    document.getElementById('cardSelectionModal').style.display='flex'; 
}

function addCard(id) { 
    currentDeck.push(id); 
    renderCurrentDeck(editingType==='player'?'pDeckContainer':'nDeckContainer'); 
    document.getElementById('cardSelectionModal').style.display='none'; 
}

function newCustomCard() {
    document.getElementById('ccId').value = "";
    document.getElementById('ccName').value = "";
    document.getElementById('ccImg').value = "";
    document.getElementById('ccElixir').value = "";
    document.getElementById('ccDesc').value = "";
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

    const cardData = {
        id: id || 'cust-'+Date.now(),
        name: name,
        img: document.getElementById('ccImg').value || 'https://via.placeholder.com/100',
        elixir: document.getElementById('ccElixir').value,
        type: document.getElementById('ccType').value,
        desc: document.getElementById('ccDesc').value
    };

    if(id) {
        const idx = gameData.cards.findIndex(x => x.id === id);
        if(idx >= 0) gameData.cards[idx] = cardData;
    } else {
        gameData.cards.push(cardData);
    }

    cloud.push();
    alert("Carte sauvegardée !");
    document.getElementById('createCardModal').style.display = 'none';
    openCardSelectionModal(editingType);
}

function deleteCustomCard() {
    if(!confirm("Supprimer définitivement cette carte ?")) return;
    const id = document.getElementById('ccId').value;
    gameData.cards = gameData.cards.filter(x => x.id !== id);
    cloud.push();
    document.getElementById('createCardModal').style.display = 'none';
    openCardSelectionModal(editingType);
}

// --- RELATIONS ---
function renderRelationSubjects() { 
    const c=document.getElementById('relSubjectList'); c.innerHTML=""; selectedRelationSubject=null; 
    document.getElementById('relTitle').innerText="Sélectionnez..."; 
    document.getElementById('relContainer').innerHTML=""; 
    [...gameData.players,...gameData.npcs].forEach(e=>{ 
        const d = document.createElement('div'); d.className='list-card-item'; d.onclick = () => loadRelationsFor(e.id, e.name);
        d.innerHTML = `<b>${e.name}</b>`;
        c.appendChild(d);
    }); 
}

function loadRelationsFor(id, name) { 
    selectedRelationSubject = id;
    document.getElementById('relTitle').innerText="Relations de "+name; 
    const c=document.getElementById('relContainer'); c.innerHTML=""; 
    [...gameData.players,...gameData.npcs].forEach(t=>{ 
        if(t.id==id)return; 
        const r=gameData.relations.find(x=>x.from==id&&x.to==t.id)||{status:'Inconnu',note:''}; 
        
        // Visual Status Class
        const statusCss = r.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        c.innerHTML+=`
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
    let r=gameData.relations.find(x=>x.from==from&&x.to==to); 
    if(!r){r={from:from,to:to,status:'Inconnu',note:''};gameData.relations.push(r);} 
    r[field]=val; cloud.push(); 
}

// --- LOGS ---
function renderLogs() { 
    const c=document.getElementById('logOutput'); c.innerHTML=""; 
    (gameData.logs||[]).slice().forEach(l=>{c.innerHTML+=`<div class="log-entry"><span class="log-time">[${l.t}]</span> ${l.m}</div>`;}); 
}

function addManualLog() { 
    const i=document.getElementById('customLogInput'); 
    if(i.value){ui.addLog(i.value); i.value=""; cloud.push(); refreshGameData();} 
}

function clearLogs() { if(confirm('Vider ?')){gameData.logs=[]; cloud.push(); refreshGameData();} }

// --- JOURNAL (FIXED) ---
function renderJournalList() { 
    const c=document.getElementById('journalListContainer'); c.innerHTML=""; 
    (gameData.journal||[]).sort((a,b)=>b.id-a.id).forEach(j=>{ 
        const d = document.createElement('div'); d.className='list-card-item'; d.onclick = () => loadJournal(j.id);
        d.innerHTML=`<div class="journal-date" style="font-size:0.8em;color:#aaa">${j.date}</div><b style="margin-left:5px">${j.title}</b>`;
        c.appendChild(d);
    }); 
}

function loadJournal(id) { 
    const j=gameData.journal.find(x=>x.id==id); 
    document.getElementById('jId').value=j.id; 
    document.getElementById('jTitle').value=j.title; 
    document.getElementById('jDate').value=j.date; 
    document.getElementById('jContent').value=j.content; 
    renderParticipants(j.parts||[]); 
}

function newJournalForm() { 
    ['jId','jTitle','jDate','jContent'].forEach(i=>document.getElementById(i).value=""); 
    renderParticipants([]); // Ensure list is refreshed
}

function renderParticipants(ids) {
    const c = document.getElementById('jParticipantsContainer'); c.innerHTML = "";
    const players = gameData.players || [];
    const npcs = gameData.npcs || [];
    const allActors = [...players, ...npcs];
    
    if (allActors.length === 0) {
        c.innerHTML = "<span style='color:#777; font-style:italic;'>Aucun personnage créé.</span>";
        return;
    }

    allActors.forEach(p => {
        const isChecked = (ids || []).includes(p.id) ? 'checked' : '';
        c.innerHTML += `
            <label style="display:inline-flex; align-items:center; margin-right:10px; margin-bottom:5px; background:#333; padding:5px 10px; border-radius:15px; cursor:pointer; border:1px solid #444;">
                <input type="checkbox" value="${p.id}" ${isChecked} style="margin-right:5px;"> 
                ${p.name}
            </label>`;
    });
}

function saveJournal() { 
    const id=document.getElementById('jId').value; 
    const parts = Array.from(document.querySelectorAll('#jParticipantsContainer input:checked')).map(x => parseInt(x.value));
    const j={
        id:id?parseInt(id):Date.now(), 
        title:document.getElementById('jTitle').value, 
        date:document.getElementById('jDate').value, 
        content:document.getElementById('jContent').value, 
        parts:parts
    }; 
    const i=gameData.journal.findIndex(x=>x.id==j.id); 
    if(i>=0) gameData.journal[i]=j; 
    else gameData.journal.push(j); 
    cloud.push(); 
    refreshGameData(); 
}

function genQR(id) { 
    const u=localStorage.getItem('sb_url'), k=localStorage.getItem('sb_key'); 
    if(!u) return alert("Config requise"); 
    const l=`${window.location.href.split('?')[0]}?mode=client&s=${gameData.sessionId}&id=${id}&u=${encodeURIComponent(btoa(u))}&k=${encodeURIComponent(btoa(k))}`; 
    document.getElementById('qrcode').innerHTML=""; 
    new QRCode(document.getElementById("qrcode"),{text:l,width:200,height:200}); 
    document.getElementById('qrModal').style.display='flex'; 
}

// === MAP MANAGER ===
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
    switchMap: (id) => { 
        gameData.activeMapId = id; 
        cloud.push(); 
        refreshGameData(); 
    },
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

// Map Logic
let pendingMapClick = {x:0, y:0};
function initMapInteraction() { 
    const m = document.querySelector('#gmMapContainer .world-map'); 
    if(m) { 
        m.onclick = (e) => { 
            const r = m.getBoundingClientRect(); 
            pendingMapClick = { x: ((e.clientX - r.left)/r.width)*100, y: ((e.clientY - r.top)/r.height)*100 }; 
            openMapMenu(); 
        }; 
    } 
}

function openMapMenu() { 
    const c = document.getElementById('mapPlayerButtons'); c.innerHTML = ""; 
    gameData.players.forEach(p => { 
        const div = document.createElement('div'); div.className = 'list-card-item';
        div.onclick = () => teleportPlayer(p.id);
        div.innerHTML = `<img src="${p.img}" class="avatar-circle"><b>${p.name}</b>`;
        c.appendChild(div); 
    }); 
    document.getElementById('mapMenuModal').style.display = 'flex'; 
}

function teleportPlayer(id) { 
    const p = gameData.players.find(x => x.id === id); 
    if(p) { 
        p.mapX = pendingMapClick.x; 
        p.mapY = pendingMapClick.y; 
        p.mapId = gameData.activeMapId; 
        cloud.push(); 
        refreshGameData(); 
    } 
    document.getElementById('mapMenuModal').style.display = 'none'; 
}

function renderMapPins() {
    document.querySelectorAll('.map-marker').forEach(e=>e.remove());
    [document.querySelector('#gmMapContainer'), document.querySelector('#mob-map .full-map-container')].forEach(c => {
        if(c) {
            gameData.players.forEach(p => {
                const pMap = p.mapId || 'root';
                if(p.mapX && p.mapY && pMap === gameData.activeMapId) {
                    const d = document.createElement('div'); d.className = 'map-marker';
                    d.style.left = p.mapX + '%'; d.style.top = p.mapY + '%';
                    d.style.backgroundImage = `url('${p.img||"https://via.placeholder.com/50"}')`;
                    d.innerHTML = `<div class="tooltip">${p.name}</div>`;
                    if(document.getElementById('gm-view').style.display !== 'none') d.onclick = (e) => { 
                        e.stopPropagation(); 
                        switchTab('view-players'); 
                        loadPlayer(p.id); 
                    };
                    c.appendChild(d);
                }
            });
        }
    });
}

// ============================================================
// EFFETS VISUELS (CLASH STYLE)
// ============================================================

// Fonction à appeler pour déclencher l'effet visuel sur le mobile
function playClashCardEffect(cardId) {
    // 1. Trouver la carte dans la base de données
    const card = gameData.cards.find(c => c.id === cardId);
    // Si la carte n'existe pas ou pas d'image, on utilise un "placeholder" générique
    const imgUrl = card ? card.img : 'https://via.placeholder.com/150?text=Carte';
    const cardName = card ? card.name : 'Nouvel Objet';

    // 2. Créer la structure HTML de l'effet
    const overlay = document.createElement('div');
    overlay.id = 'cr-overlay';
    // Au clic, on ferme l'animation plus vite
    overlay.onclick = function() { document.body.removeChild(overlay); };

    overlay.innerHTML = `
        <div class="cr-effect-container">
            <div class="cr-title-pop">NOUVELLE CARTE !</div>
            <div class="cr-burst"></div>
            <img src="${imgUrl}" class="cr-new-card-pop">
            <div class="cr-name-pop">${cardName}</div>
        </div>
    `;

    // 3. Ajouter à la page (ça lance les animations CSS automatiquement)
    document.body.appendChild(overlay);

    // 4. Supprimer automatiquement après 4 secondes si le joueur n'a pas cliqué
    setTimeout(() => {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    }, 4000);
}

client.check();
setTimeout(() => { initMapInteraction(); }, 1000);