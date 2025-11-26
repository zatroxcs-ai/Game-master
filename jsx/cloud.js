// === CLOUD ===
const cloud = {
    client: null,
    setup: () => {
        const u = document.getElementById('sbUrl').value.trim();
        const k = document.getElementById('sbKey').value.trim();
        if(!u || !k) { alert("Champs vides !"); return; }
        localStorage.setItem('sb_url',u); 
        localStorage.setItem('sb_key',k); 
        location.reload(); 
    },
    init: () => {
        const u = localStorage.getItem('sb_url');
        const k = localStorage.getItem('sb_key');
        if(typeof supabase === 'undefined') { debugMob("Supabase manquant"); return; }
        if(u && k) {
            try {
                cloud.client = supabase.createClient(u, k);
                cloud.pull();
                cloud.client.channel('public:sessions').on('postgres_changes', 
                    { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${gameData.sessionId}` }, 
                    payload => { 
                        if(payload.new && payload.new.data) { 
                            gameData = payload.new.data; 
                            refreshGameData(); 
                        } 
                    }).subscribe(s => {
                        if(s==='SUBSCRIBED') { 
                            const dot = document.getElementById('statusDot'); 
                            if(dot) { dot.innerText = "🟢 Online"; dot.style.color = "#2ecc71"; } 
                        }
                    });
            } catch(e) { debugMob("Init Err: " + e.message); }
        }
    },
    push: async () => { 
        if(!cloud.client) return; 
        await cloud.client.from('sessions').upsert({ id: gameData.sessionId, data: gameData }); 
    },
    pull: async () => {
        if(!cloud.client) return;
        const {data} = await cloud.client.from('sessions').select('data').eq('id', gameData.sessionId).single();
        if(data) { 
            gameData = data.data; 
            refreshGameData(); 
        } else {
            cloud.push();
        }
    }
};