// Test v Node: stavy, NaN, bot dokončí první kolo; screenshoty do adresáře z argumentu
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || '/tmp';
const g = H.load([root + '/js/speccy.js', root + '/js/game.js']);
const G = g.sandbox.GAME, Z = g.Z;
function assert(c, m) { if (!c) { console.error('SELHÁNÍ: ' + m); process.exit(1); } }
function tap(code) { g.key(code, true); g.step(2); g.key(code, false); g.step(1); }

g.step(60); g.png(out + '/title.png', 3);
assert(G.state() === 'title', 'title');
tap(32); assert(G.state() === 'play', 'start hry');

const S = G.S;
function bot() {
    let want = 0, best = null;
    S.en.forEach(e => { if (e.alive && (!best || e.z < best.z)) best = e; });
    if (best) want = Math.sign(best.x - S.px) * (Math.abs(best.x - S.px) > 0.5 ? 1 : 0);
    const lat = 0.09 + S.sp * 0.25;
    const clear = d => {
        let m = 9;
        for (const tr of S.trees) {
            if (tr.z < 0.6 || tr.z > 14) continue;
            const ticks = Math.max(0, (tr.z - 1) / S.sp);
            for (const f of [0.5, 1]) {
                const x = Math.max(-9, Math.min(9, S.px + d * lat * ticks * f));
                if (f === 0.5 && tr.z > 8) continue;
                m = Math.min(m, Math.abs(tr.x - x));
            }
        }
        return m;
    };
    const order = want === 0 ? [0, -1, 1] : want < 0 ? [-1, 0, 1] : [1, 0, -1];
    let pick = order.find(d => clear(d) >= 1.0);
    if (pick === undefined) pick = [-1, 0, 1].sort((a, b) => clear(b) - clear(a))[0];
    S._pick = pick;
    g.Z.input[pick < 0 ? 'press' : 'release']('left');
    g.Z.input[pick > 0 ? 'press' : 'release']('right');
    g.Z.input.press('fire');
    g.Z.input[best && best.z > 8 ? 'press' : 'release']('up');
}
const HH = [];
let seenDie = false, shot = false, cleared = {};
for (let i = 0; i < 40000; i++) {
    if (G.state() === 'play') bot();
    else { ['left', 'right', 'up', 'fire'].forEach(a => g.Z.input.release(a)); }
    HH.push([S.px.toFixed(2), S._pick, S.trees.filter(t => t.z < 9 && Math.abs(t.x - S.px) < 3).map(t => t.x.toFixed(1) + ',' + t.z.toFixed(1)).join(' ')].join(' | ')); if (HH.length > 14) HH.shift();
    g.step(1);
    if (G.state() === 'dying' && !seenDie) console.log(HH.join('\n'));
    if (G.state() === 'dying') seenDie = true;
    if (G.state() === 'clear') { cleared[S.round] = true; }
    if (i === 600 && !shot) { g.png(out + '/play.png', 3); shot = true; }
    if (S.round === 2 && !cleared.p2 && G.state() === 'play') { cleared.p2 = 1; g.png(out + '/r2.png', 3); }
    if (S.round === 4 && !cleared.p4 && G.state() === 'play') { cleared.p4 = 1; g.png(out + '/r4.png', 3); }
    if (S.round === 3 && !cleared.p3 && G.state() === 'play') { cleared.p3 = 1; g.png(out + '/r3.png', 3); }
    if (i % 500 === 0) assert(!g.hasNaN(S), 'NaN ve stavu');
    if (G.state() === 'over') break;
}
console.log(G.log);console.log('round', S.round, 'score', S.score, 'lives', S.lives, 'state', G.state(), 'cleared', Object.keys(cleared), 'died', seenDie);
assert(cleared[1], 'bot nedokončil kolo 1');
// nech dojít do konce hry bez bota
['left', 'right', 'up', 'fire'].forEach(a => g.Z.input.release(a));
for (let i = 0; i < 20000 && G.state() !== 'over'; i++) { if (G.state() === 'play') g.Z.input.press('right'); g.step(1); }
assert(G.state() === 'over', 'konec hry');
g.png(out + '/over.png', 3);
g.step(150); tap(32);
assert(G.state() === 'title', 'návrat na title');
assert(!g.hasNaN(S), 'NaN');
console.log('OK, rekord', Z.hi.get('honicka'));
