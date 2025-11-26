// === DATA MODEL ===
let gameData = {
    players: [],
    npcs: [],
    journal: [],
    logs: [],
    relations: [],
    chat: [],
    maps: [
        { id: 'root', name: 'Monde Principal', img: 'map.png' },
        { id: 'enfers', name: 'Royaume des Enfers', img: 'enfers.png' } 
    ],
    activeMapId: 'root',
    cards: [ 
        {id:'c1', name:'Chevalier', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/a/a2/KnightCard.png&h=100'},
        {id:'c2', name:'Archers', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/d/d4/ArchersCard.png&h=100'},
        {id:'c3', name:'Géant', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/e/ec/GiantCard.png&h=100'},
        {id:'c4', name:'Mousquetaire', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/6/60/MusketeerCard.png&h=100'},
        {id:'c5', name:'Mini P.E.K.K.A', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/1/1a/MiniPEKKACard.png&h=100'},
        {id:'c6', name:'Prince', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/f/f3/PrinceCard.png&h=100'},
        {id:'c7', name:'Bébé Dragon', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/9/90/BabyDragonCard.png&h=100'},
        {id:'c8', name:'Armée de Squelettes', img:'https://wsrv.nl/?url=https://static.wikia.nocookie.net/clashroyale/images/7/70/SkeletonArmyCard.png&h=100'},
        {id:'i1', name:'Potion de Soin', img:'https://via.placeholder.com/100/e74c3c/fff?text=Soin'},
        {id:'i2', name:'Parchemin', img:'https://via.placeholder.com/100/f1c40f/000?text=Quest'}
    ],
    // ICI : Ton ID fixe pour retrouver ta sauvegarde
    sessionId: 'sess-1764101013787'
};

// Fonction de debug
function debugMob(msg, color='red') {
    const el = document.getElementById('mobRegion'); 
    const params = new URLSearchParams(window.location.search);
    if(el && params.get('mode') === 'client' && !el.innerHTML.includes(msg)) {
        el.innerHTML += `<br><span style="color:${color}; font-size:0.8em">${msg}</span>`;
    }
}