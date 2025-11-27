// === CLOUD SUPABASE (CONNEXION AUTOMATIQUE) ===

// 1. ENTRE TES INFOS SUPABASE ICI (Entre les guillemets)
const SUPABASE_CONFIG = {
    url: "https://vrhkqkujylzvjdzjpraa.supabase.co",  // Remplace par ton URL (celle de la barre d'adresse)
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaGtxa3VqeWx6dmpkempwcmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzQ1MjMsImV4cCI6MjA3OTY1MDUyM30.YB5xJdezJkcWaRx1DFSnKa8ePfbvqDbnGffF7dix-14"                         // Remplace par ta clé ANON (la longue suite de caractères)
};

const cloud = {
    client: null,

    // Cette fonction sert maintenant juste à forcer une reconnexion manuelle si besoin
    setup: () => {
        const u = document.getElementById('sbUrl').value.trim();
        const k = document.getElementById('sbKey').value.trim();
        if(u && k) {
            localStorage.setItem('sb_url', u);
            localStorage.setItem('sb_key', k);
            location.reload();
        }
    },

    init: () => {
        // 2. ON UTILISE TES CLÉS EN DUR PRIORITAIREMENT
        // Si tu as rempli la config en haut, on l'utilise. Sinon on regarde le stockage local.
        const u = SUPABASE_CONFIG.url !== "https://xxxxxxxxxxxx.supabase.co" ? SUPABASE_CONFIG.url : localStorage.getItem('sb_url');
        const k = SUPABASE_CONFIG.key !== "eyJh......" ? SUPABASE_CONFIG.key : localStorage.getItem('sb_key');

        // On remplit les champs du modal pour info (visuel seulement)
        const inputUrl = document.getElementById('sbUrl');
        const inputKey = document.getElementById('sbKey');
        if(inputUrl && u) inputUrl.value = u;
        if(inputKey && k) inputKey.value = k;

        if (typeof supabase === 'undefined') {
            debugMob("Erreur: Librairie Supabase non chargée.");
            return;
        }

        if (u && k) {
            try {
                cloud.client = supabase.createClient(u, k);
                
                // Charger les données
                cloud.pull();
                
                // Écouter les changements
                cloud.client.channel('public:sessions').on('postgres_changes', 
                    { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${gameData.sessionId}` }, 
                    payload => {
                        if (payload.new && payload.new.data) {
                            gameData = payload.new.data;
                            if(typeof refreshGameData === 'function') refreshGameData();
                        }
                    }
                ).subscribe(status => {
                    if (status === 'SUBSCRIBED') {
                        const dot = document.getElementById('statusDot');
                        if (dot) {
                            dot.innerText = "🟢 Online";
                            dot.style.color = "#2ecc71";
                        }
                    }
                });
            } catch (e) {
                debugMob("Erreur Init Supabase: " + e.message);
            }
        } else {
            console.log("Aucune clé trouvée. Remplissez SUPABASE_CONFIG dans js/cloud.js");
            const dot = document.getElementById('statusDot');
            if(dot) dot.innerText = "🔴 Config Manquante";
        }
    },

    push: async () => {
        if (!cloud.client) return;
        await cloud.client.from('sessions').upsert({ 
            id: gameData.sessionId, 
            data: gameData 
        });
    },

    pull: async () => {
        if (!cloud.client) return;
        const { data, error } = await cloud.client.from('sessions').select('data').eq('id', gameData.sessionId).single();
        
        if (data) {
            gameData = data.data;
            if(typeof refreshGameData === 'function') refreshGameData();
        } else if (!error) {
            cloud.push();
        }
    }
};
