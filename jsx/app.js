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

// === CLIENT ===
const client = {
    check: () => {
        const params = new URLSearchParams(window.location.search);
        if(params.get('mode') === 'client') {
            document.getElementById('gm-view').style.display = 'none'; 
            document.getElementById('client-view').style.display = 'flex'; 
            document.title = "Jeu en cours";
            try {
                let u = atob(params.get('u')), k = atob(params.get('k'));
                localStorage.setItem('sb_url', u); localStorage.setItem('sb_key', k); gameData.sessionId = params.get('s'); cloud.init();
            } catch(e) { document.getElementById('mobName').innerText = "ERREUR LIEN"; }
        } else cloud.init();
    },
    render: (d) => {
        const id = parseInt(new URLSearchParams(window.location.search).get('id'));
        const p = d.players.find(x => x.id === id);
        if(p) {
            document.getElementById('mobName').innerText = p.name;
            document.getElementById('mobImg').src = p.img || "https://via.placeholder.com/150";
            const regionEl = document.getElementById('mobRegion');
            if(!regionEl.innerHTML.includes("Erreur")) regionEl.innerText = p.region || "Inconnu";
            document.getElementById('mobGold').innerText = p.gold; 
            document.getElementById('mobElixir').innerText = p.elixir;
            document.getElementById('mobInv').innerText = p.inv || "";
            
            const md = document.getElementById('mobDeckDisplay'); md.innerHTML = "";
            if(p.deck && p.deck.length>0) {
                p.deck.forEach(cid => { 
                    const c=gameData.cards.find(x=>x.id==cid); 
                    if(c) md.innerHTML+=`<img src="${c.img}" style="width:40px; height:50px; object-fit:contain;">`; 
                });
            } else md.innerHTML = "<small style='color:#555'>Aucune carte</small>";
            
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

client.check();
setTimeout(() => { initMapInteraction(); }, 1000);
</script>
</body>
</html>

---

### 5. Fichier `index.html` (La structure)

Colle ce code dans ton `index.html`. C'est la "coquille" qui va charger les 4 autres fichiers. Il contient le HTML qui était dans le `body` de ton fichier original, mais sans le CSS ni le JS (qui sont maintenant linkés).

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Manager Royale V19 - Architecture Pro</title>
    
    <script src="[https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)"></script>
    <script src="[https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js)"></script>
    
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <div id="toast" class="toast">Sauvegarde effectuée !</div>

    <div id="client-view">
        <div class="mob-header">
            <button id="tab-stats" class="tab-btn mob-tab-btn active" onclick="client.switchTab('stats')">📊 STATS</button>
            <button id="tab-map" class="tab-btn mob-tab-btn" onclick="client.switchTab('map')">🌍 CARTE</button>
            <button id="tab-journal" class="tab-btn mob-tab-btn" onclick="client.switchTab('journal')">📖 JRNL</button>
            <button id="tab-chat" class="tab-btn mob-tab-btn" onclick="client.switchTab('chat')">💬 CHAT</button>
        </div>

        <div id="mob-stats" class="mob-container active">
            <div class="mob-scroll-content">
                <img id="mobImg" src="" style="width:120px; height:120px; border-radius:50%; border:4px solid var(--accent); margin:0 auto 10px auto; display:block; object-fit:cover; background:#333;">
                <h1 id="mobName" style="color:var(--accent); margin:0; text-align:center;">Chargement...</h1>
                <div style="margin-bottom:20px; color:#777; text-align:center;" id="mobRegion">-</div>
                
                <div style="display:flex; width:100%; gap:10px; margin-bottom:10px;">
                    <div class="mob-card">
                        <div class="mob-val" style="color:#f1c40f" id="mobGold">0</div>
                        <div class="mob-label">Or</div>
                    </div>
                    <div class="mob-card">
                        <div class="mob-val" style="color:#e91e63" id="mobElixir">0</div>
                        <div class="mob-label">Élixir</div>
                    </div>
                </div>
                <div class="mob-card">
                    <div class="mob-label" style="border-bottom:1px solid #444; margin-bottom:5px;">Deck de Combat</div>
                    <div id="mobDeckDisplay" style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; min-height:40px;"></div>
                </div>
                <div class="mob-card" style="text-align:left;">
                    <div class="mob-label" style="margin-bottom:10px;">INVENTAIRE</div>
                    <div id="mobInv" style="white-space: pre-wrap; font-size: 0.9em; color: #ddd;"></div>
                </div>
            </div>
        </div>

        <div id="mob-map" class="mob-container" style="background:#000;">
            <div class="full-map-container">
                <img src="map.png" class="world-map" onerror="this.src='[https://via.placeholder.com/800x600?text=Carte+Non+Trouvee](https://via.placeholder.com/800x600?text=Carte+Non+Trouvee)'">
            </div>
        </div>

        <div id="mob-journal" class="mob-container">
            <div id="mobJournalList" class="mob-scroll-content"></div>
        </div>

        <div id="mob-chat" class="mob-container">
            <div id="mobChatFeed" class="chat-feed"></div>
            <div class="chat-input-area">
                <select id="mobChatTarget" style="width:110px; margin:0; font-size:0.8em;">
                    <option value="global">Global</option>
                    <option value="gm">Au MJ</option>
                </select>
                <input type="text" id="mobChatInput" placeholder="Message..." style="margin:0;">
                <button class="action-btn" onclick="sendChatMessage('mobile')">Envoyer</button>
            </div>
        </div>
    </div>

    <div id="gm-view" style="display:flex; flex-direction:column; height:100%;">
        <header>
            <div class="nav-tabs">
                <button class="tab-btn active" onclick="switchTab('view-map')">🌍 Carte</button>
                <button class="tab-btn" onclick="switchTab('view-chat')">💬 Chat</button>
                <button class="tab-btn" onclick="switchTab('view-players')">👑 Joueurs</button>
                <button class="tab-btn" onclick="switchTab('view-npcs')">🎭 PNJ</button>
                <button class="tab-btn" onclick="switchTab('view-relations')">🤝 Relations</button>
                <button class="tab-btn" onclick="switchTab('view-journal')">📖 Journal</button>
                <button class="tab-btn" onclick="switchTab('view-logs')">📜 Logs</button>
            </div>
            <div class="controls-area">
                <span id="statusDot" style="color:red; font-size: 0.8em;">● Offline</span>
                <button class="action-btn" onclick="document.getElementById('setupModal').style.display='flex'">☁️ CONFIG</button>
                <button class="action-btn save-btn" onclick="saveData(true)">💾 SAUVER</button>
            </div>
        </header>

        <div id="view-map" class="view-section active">
            <div style="display: flex; width: 100%; height: 100%;">
                <div class="map-sidebar">
                    <div style="padding:10px; font-weight:bold; color:var(--accent); border-bottom:1px solid #333;">ATLAS</div>
                    <div id="mapListContainer" class="map-list"></div>
                    <div class="map-controls">
                        <input type="text" id="newMapName" placeholder="Nom (ex: Enfers)" style="width:100%; margin:0; font-size:0.8em;">
                        <button class="action-btn" onclick="mapManager.addMap()">+</button>
                    </div>
                    <div class="map-controls">
                        <input type="text" id="editMapUrl" placeholder="URL Image .png" style="width:100%; margin:0; font-size:0.8em;" onchange="mapManager.updateUrl()">
                    </div>
                </div>
                <div class="map-view-area">
                    <div id="gmMapContainer" class="full-map-container">
                        <img id="worldMapImg" src="" class="world-map" alt="Carte">
                    </div>
                    <div style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.7); padding:5px 10px; border-radius:4px; pointer-events:none;">
                        <span id="currentMapLabel" style="color:white; font-weight:bold;">Chargement...</span>
                    </div>
                </div>
            </div>
        </div>

        <div id="view-chat" class="view-section">
            <div class="split-layout">
                <div class="list-panel">
                    <div class="list-card-item selected" onclick="loadGmChat('global')" id="chan-global"><b>🌍 Global</b></div>
                    <div id="gmChatChannels"></div>
                </div>
                <div class="detail-panel" style="padding:0; display:flex; flex-direction:column;">
                    <div style="padding:10px; background:#222; border-bottom:1px solid #444;" id="gmChatTitle">Global</div>
                    <div id="gmChatFeed" class="chat-feed" style="background:#1a1a1a;"></div>
                    <div class="chat-input-area">
                        <input type="text" id="gmChatInput" placeholder="Message..." style="margin:0;">
                        <button class="action-btn" onclick="sendChatMessage('gm')">Envoyer</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="view-players" class="view-section">
            <div class="split-layout">
                <div class="list-panel">
                    <button class="action-btn save-btn" style="width:100%; margin-bottom:10px;" onclick="newPlayerForm()">+ Nouveau</button>
                    <div id="playersListContainer"></div>
                </div>
                <div class="detail-panel">
                    <h3>Édition Seigneur</h3>
                    <input type="hidden" id="pId">
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="pName" placeholder="Nom du Personnage">
                        <input type="text" id="pImg" placeholder="Avatar URL">
                    </div>
                    <input type="text" id="pRegion" placeholder="Région actuelle">
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1"><label>Or</label><input type="number" id="pGold"></div>
                        <div style="flex:1"><label>Élixir</label><input type="number" id="pElixir"></div>
                        <div style="flex:1"><label>Noir</label><input type="number" id="pDark"></div>
                    </div>
                    <label>Inventaire</label>
                    <textarea id="pTextInv" placeholder="..." style="height:80px;"></textarea>
                    
                    <label>Deck (Combat)</label>
                    <div id="pDeckContainer" class="visual-inv-box"></div>
                    <button class="action-btn" style="width:100%; margin-top:5px; background:#444;" onclick="openCardSelectionModal('player')">+ Cartes</button>
                    
                    <div style="margin-top:20px; text-align:right;">
                        <button class="action-btn reset-btn" onclick="deleteEntity('players')">Supprimer</button>
                        <button class="action-btn save-btn" onclick="savePlayer()">Enregistrer</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="view-npcs" class="view-section">
            <div class="split-layout">
                <div class="list-panel">
                    <button class="action-btn save-btn" style="width:100%; margin-bottom:10px; background:var(--npc-color);" onclick="newNPCForm()">+ Nouveau PNJ</button>
                    <div id="npcsListContainer"></div>
                </div>
                <div class="detail-panel">
                    <h3 style="color:var(--npc-color)">Édition PNJ</h3>
                    <input type="hidden" id="nId">
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="nName" placeholder="Nom du PNJ">
                        <input type="text" id="nType" placeholder="Rôle">
                    </div>
                    <input type="text" id="nImg" placeholder="Avatar URL">
                    <textarea id="nStory" placeholder="Histoire..." style="height:80px;"></textarea>
                    <label>Deck / Objets</label>
                    <div id="nDeckContainer" class="visual-inv-box"></div>
                    <button class="action-btn" style="width:100%; margin-top:5px; background:#444;" onclick="openCardSelectionModal('npc')">+ Cartes / Objets</button>
                    <div style="margin-top:20px; text-align:right;">
                        <button class="action-btn reset-btn" onclick="deleteEntity('npcs')">Supprimer</button>
                        <button class="action-btn save-btn" style="background:var(--npc-color)" onclick="saveNPC()">Enregistrer PNJ</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="view-relations" class="view-section">
            <div class="split-layout">
                <div class="list-panel">
                    <div id="relSubjectList"></div>
                </div>
                <div class="detail-panel">
                    <h3 id="relTitle">Sélectionnez...</h3>
                    <div id="relContainer"></div>
                </div>
            </div>
        </div>

        <div id="view-journal" class="view-section">
            <div class="split-layout">
                <div class="list-panel">
                    <button class="action-btn save-btn" style="width:100%; margin-bottom:10px;" onclick="newJournalForm()">+ Nouvelle Entrée</button>
                    <div id="journalListContainer"></div>
                </div>
                <div class="detail-panel">
                    <input type="hidden" id="jId">
                    <input type="text" id="jTitle" placeholder="Titre du chapitre">
                    <input type="text" id="jDate" placeholder="Date / Heure">
                    
                    <label>Participants</label>
                    <div id="jParticipantsContainer" class="visual-inv-box" style="border:none; display:flex; flex-wrap:wrap;"></div>
                    
                    <textarea id="jContent" placeholder="Récit..." style="height:250px; margin-top:10px;"></textarea>
                    <button class="action-btn save-btn" onclick="saveJournal()">Sauvegarder</button>
                </div>
            </div>
        </div>

        <div id="view-logs" class="view-section">
            <div class="log-container"><div id="logOutput"></div></div>
            <div style="padding:10px; background:#222; display:flex; gap:10px;">
                <input type="text" id="customLogInput" placeholder="Log manuel..." style="margin:0;">
                <button class="action-btn" onclick="addManualLog()">Ajouter</button>
                <button class="action-btn reset-btn" onclick="clearLogs()">Vider</button>
            </div>
        </div>
    </div>

    <div id="setupModal" class="modal-overlay">
        <div class="modal-content">
            <span class="close-modal" onclick="document.getElementById('setupModal').style.display='none'">&times;</span>
            <h3>Connexion Supabase</h3>
            <input type="text" id="sbUrl" placeholder="URL">
            <input type="text" id="sbKey" placeholder="Key">
            <button class="action-btn save-btn" onclick="cloud.setup()">Connecter</button>
        </div>
    </div>

    <div id="qrModal" class="modal-overlay" onclick="this.style.display='none'">
        <div class="modal-content" onclick="event.stopPropagation()">
            <h3>Scanner pour rejoindre</h3>
            <div id="qrcode" style="background:white; padding:10px; display:inline-block; margin:10px 0;"></div>
        </div>
    </div>

    <div id="cardSelectionModal" class="modal-overlay">
        <div class="modal-content" style="max-width:600px;">
            <span class="close-modal" onclick="document.getElementById('cardSelectionModal').style.display='none'">&times;</span>
            <h3>Ajouter Carte</h3>
            <button class="action-btn save-btn" style="width:100%; margin-bottom:15px; background:#27ae60; padding:15px;" onclick="newCustomCard()">
                + CRÉER UNE NOUVELLE CARTE (DB)
            </button>
            <div id="cardsGrid" class="cards-grid"></div>
        </div>
    </div>

    <div id="createCardModal" class="modal-overlay" style="z-index:200">
        <div class="modal-content">
            <h3>✨ Éditer Carte</h3>
            <input type="hidden" id="ccId">
            <input type="text" id="ccName" placeholder="Nom (ex: Dragon)">
            <input type="text" id="ccImg" placeholder="URL Image">
            <div style="display:flex; gap:10px;">
                <input type="number" id="ccElixir" placeholder="Coût" style="flex:1">
                <select id="ccType" style="flex:1">
                    <option>Troupe</option>
                    <option>Sort</option>
                    <option>Bâtiment</option>
                    <option>Objet</option>
                    <option>Objet de Quete</option>
                </select>
            </div>
            <textarea id="ccDesc" placeholder="Description..." style="height:80px;"></textarea>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="action-btn reset-btn" id="btnDeleteCard" style="display:none;" onclick="deleteCustomCard()">Supprimer</button>
                <button class="action-btn" onclick="document.getElementById('createCardModal').style.display='none'">Annuler</button>
                <button class="action-btn save-btn" onclick="saveCustomCard()">Sauvegarder</button>
            </div>
        </div>
    </div>

    <div id="mapMenuModal" class="modal-overlay">
        <div class="modal-content">
            <span class="close-modal" onclick="document.getElementById('mapMenuModal').style.display='none'">&times;</span>
            <h3>Déplacer qui ici ?</h3>
            <div id="mapPlayerButtons" style="display:flex; flex-direction:column; gap:5px; max-height:300px; overflow-y:auto;"></div>
            <button class="action-btn reset-btn" style="margin-top:10px; width:100%" onclick="document.getElementById('mapMenuModal').style.display='none'">Annuler</button>
        </div>
    </div>

    <script src="js/data.js"></script>
    <script src="js/cloud.js"></script>
    <script src="js/app.js"></script>

</body>
</html>