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

        // On remplit les champs du modal si les infos existent
        const inputUrl = document.getElementById('sbUrl');
        const inputKey = document.getElementById('sbKey');
        if(inputUrl && u) inputUrl.value = u;
        if(inputKey && k) inputKey.value = k;

        if(typeof supabase === 'undefined') { 
            console.error("Supabase non chargé"); 
            return; 
        }

        if(u && k) {
            try {
                cloud.client = supabase.createClient(u, k);
                cloud.pull(); // Récupération initiale
                
                // Écoute temps réel
                cloud.client.channel('public:sessions').on('postgres_changes', 
                    { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${gameData.sessionId}` }, 
                    payload => { 
                        if(payload.new && payload.new.data) { 
                            gameData = payload.new.data; 
                            // Appel sécurisé à la fonction de rafraichissement de l'UI
                            if(typeof refreshGameData === 'function') refreshGameData();
                        } 
                    }).subscribe(status => {
                        if(status === 'SUBSCRIBED') { 
                            const dot = document.getElementById('statusDot'); 
                            if(dot) { dot.innerText = "🟢 Online"; dot.style.color = "#2ecc71"; } 
                        }
                    });
            } catch(e) { 
                console.error("Erreur Init Supabase:", e); 
            }
        } else {
            console.log("Pas d'identifiants Supabase trouvés.");
        }
    },

    push: async () => { 
        if(!cloud.client) return; 
        await cloud.client.from('sessions').upsert({ id: gameData.sessionId, data: gameData }); 
    },

    pull: async () => {
        if(!cloud.client) return;
        const {data, error} = await cloud.client.from('sessions').select('data').eq('id', gameData.sessionId).single();
        if(data) { 
            gameData = data.data; 
            if(typeof refreshGameData === 'function') refreshGameData(); 
        } else {
            console.log("Session introuvable ou nouvelle, push initial...");
            cloud.push();
        }
    }
};