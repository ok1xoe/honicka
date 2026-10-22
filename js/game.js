// Lesní honička – 3D pohled zezadu na motorku, pseudo-3D les (styl Deathchase)
(function () {
    'use strict';
    var HOR = 70, F = 90, GH = 100, MAXZ = 44, HALF = 9;
    var PAL = [
        { sky: 13, gnd: 12, fol: 4, fol2: 4, trunk: 6, band: 4, name: 'DEN' },
        { sky: 3, gnd: 2, fol: 0, fol2: 1, trunk: 0, band: 3, name: 'SOUMRAK' },
        { sky: 0, gnd: 1, fol: 4, fol2: 1, trunk: 2, band: 0, name: 'NOC' }
    ];
    var TYPES = ['bike', 'heli', 'bike', 'tank'];
    var G = window.GAME = {};
    var S = {}; // stav
    var state = 'title', t = 0;

    Z.init({
        title: 'Lesní honička',
        touch: [{ act: 'left', label: '◀' }, { act: 'right', label: '▶' }, { act: 'up', label: '▲' }, { act: 'down', label: '▼' }, { act: 'fire', label: 'OHEŇ', cls: 'big' }]
    });

    function rnd(a, b) { return a + Math.random() * (b - a); }

    // ---------- Kolo
    function roundCfg(r) {
        var d = Math.floor((r - 1) / 4);
        return { type: TYPES[(r - 1) % 4], pal: PAL[(r - 1) % 3], dens: Math.min(130, 80 + d * 10), limit: Math.max(35, 60 - d * 5) * 50, spd: 0.17 + Math.min(d, 4) * 0.01 };
    }
    function newTree(far) {
        var x = rnd(-HALF - 2, HALF + 2);
        return { x: x, z: far ? rnd(1.5, MAXZ) : MAXZ - rnd(0, 2), v: (Math.random() * 3) | 0 };
    }
    function startRound(keepLives) {
        var c = S.cfg = roundCfg(S.round);
        S.trees = [];
        for (var i = 0; i < c.dens; i++) { S.trees.push(newTree(true)); }
        S.px = 0; S.sp = 0.2; S.lean = 0; S.cool = 0; S.shots = []; S.ebul = []; S.time = c.limit; S.phase = 0; S.hold = 0;
        var n = c.type === 'bike' ? 2 : 1;
        S.en = [];
        for (var k = 0; k < n; k++) {
            S.en.push({ type: c.type, x: rnd(-6, 6), z: 26 + k * 7, vx: rnd(-0.05, 0.05), sp: c.spd + rnd(-0.03, 0.01), hp: c.type === 'tank' ? 3 : c.type === 'heli' ? 2 : 1, alive: true, flash: 0, fire: 120 + k * 60, t: 0 });
        }
        if (c.type === 'tank') { S.en[0].sp = 0.1; }
        if (c.type === 'heli') { S.en[0].sp = c.spd; }
        clearAround();
    }
    function clearAround() {
        S.trees = S.trees.filter(function (tr) { return !(tr.z < 10 && Math.abs(tr.x - S.px) < 3); });
        while (S.trees.length < S.cfg.dens) { var tr = newTree(false); if (tr.z > 20 || Math.abs(tr.x - S.px) > 3) { S.trees.push(tr); } }
    }
    function newGame() {
        S.score = 0; S.lives = 3; S.round = 1; S.next = 10000;
        startRound();
        state = 'play'; Z.pauseOk = true;
    }

    // ---------- Tick
    function tick() {
        t++;
        if (state === 'title') { if (Z.input.hit('fire')) { newGame(); Z.snd.win(); } return; }
        if (state === 'over') { if (--S.hold <= 0 && Z.input.hit('fire')) { state = 'title'; } return; }
        Z.pauseOk = state === 'play';
        if (state === 'dying') { if (--S.hold <= 0) { if (S.lives <= 0) { gameOver(); } else { S.px = 0; S.sp = 0.2; S.ebul = []; clearAround(); state = 'play'; S.inv = 90; } } scroll(0.02); return; }
        if (state === 'clear') { scroll(S.sp); if (--S.hold <= 0) { S.round++; startRound(); state = 'play'; } return; }
        play();
    }
    function scroll(sp) {
        S.trees.forEach(function (tr) { tr.z -= sp; if (tr.z < 0.5) { var n = newTree(false); tr.x = n.x; tr.z = n.z; tr.v = n.v; } });
    }
    function play() {
        var inp = Z.input;
        var steer = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
        var target = inp.down('up') ? 0.32 : inp.down('down') ? 0.1 : 0.2;
        S.sp += (target - S.sp) * 0.05;
        S.lean += (steer - S.lean) * 0.25;
        S.px = Z.clamp(S.px + steer * (0.09 + S.sp * 0.25), -HALF, HALF);
        S.time--; S.inv = Math.max(0, (S.inv || 0) - 1);
        S.score += 0; if (t % 10 === 0) { S.score += Math.round(S.sp * 50); }
        if (S.cool > 0) { S.cool--; }
        if (inp.down('fire') && S.cool === 0) { S.shots.push({ x: S.px, z: 1.5 }); S.cool = 14; Z.snd.shoot(); }
        scroll(S.sp);
        // střely
        S.shots.forEach(function (s) {
            var nz = s.z + 1.1;
            S.en.forEach(function (e) {
                if (e.alive && e.z >= s.z - 0.3 && e.z <= nz + 0.3 && Math.abs(e.x - s.x) < 0.9 + e.z * 0.05) { hitEnemy(e); s.z = 999; }
            });
            if (s.z < 900) { s.z = nz; }
            S.trees.forEach(function (tr) { if (s.z < 900 && tr.z > s.z - 0.6 && tr.z < s.z + 0.6 && Math.abs(tr.x - s.x) < 0.3 && tr.z < 6) { s.z = 999; } });
        });
        S.shots = S.shots.filter(function (s) { return s.z < 19; });
        // nepřátelé
        var allDead = true;
        S.en.forEach(function (e) {
            if (!e.alive) { if (e.flash > 0) { e.flash--; } return; }
            allDead = false; e.t++;
            if (e.flash > 0) { e.flash--; }
            e.z += e.sp + 0.04 * Math.sin(e.t / 40) - S.sp; e.z = Z.clamp(e.z, 3, 56);
            if (e.t % (e.type === 'heli' ? 40 : 70) === 0) { e.vx = rnd(-0.1, 0.1) * (e.type === 'heli' ? 1.8 : e.type === 'tank' ? 0.4 : 1); }
            e.x += e.vx; if (Math.abs(e.x) > HALF - 1) { e.vx = -e.vx; e.x = Z.clamp(e.x, -HALF + 1, HALF - 1); }
            if (e.type !== 'bike' && --e.fire <= 0) { e.fire = e.type === 'heli' ? 110 : 150; if (e.z < 36) { S.ebul.push({ x: e.x, z: e.z, vx: (S.px - e.x) / (e.z / 0.35) }); Z.snd.noise && Z.snd.noise(0.1); } }
            if (e.z < 3.2 && Math.abs(e.x - S.px) < 1.1 && !S.inv) { crash('ram'); }
        });
        S.ebul.forEach(function (b) { b.z -= 0.35; b.x += b.vx; if (b.z < 1.3 && b.z > 0.6 && Math.abs(b.x - S.px) < 0.9 && !S.inv) { b.z = -1; crash('strela'); } });
        S.ebul = S.ebul.filter(function (b) { return b.z > 0.6; });
        // srážka se stromem
        if (!S.inv && state === 'play') {
            for (var i = 0; i < S.trees.length; i++) { var tr = S.trees[i]; if (tr.z < 1.3 && tr.z > 0.5 && Math.abs(tr.x - S.px) < 0.55) { crash('strom'); break; } }
        }
        if (state !== 'play') { return; }
        if (allDead) { roundDone(); } else if (S.time <= 0) { crash('cas'); }
    }
    function hitEnemy(e) {
        e.hp--; e.flash = 8;
        if (e.hp > 0) { Z.snd.hit(); return; }
        e.alive = false; e.flash = 40; Z.snd.boom();
        var pts = e.type === 'tank' ? 1500 : e.type === 'heli' ? 1000 : 500;
        S.score += pts; addScore(0);
    }
    function addScore(n) { S.score += n; if (S.score >= S.next) { S.next += 10000; S.lives++; Z.snd.win(); } }
    function roundDone() {
        var bonus = Math.round(S.time / 50) * 20;
        S.bonus = bonus; addScore(bonus);
        S.hold = 150; state = 'clear'; Z.snd.win();
    }
    function crash(timeout) {
        G.log = G.log || []; G.log.push(timeout);
        S.lives--; S.crashTimeout = timeout === 'cas'; S.hold = 80; state = 'dying'; Z.snd.die();
        if (timeout === 'cas') { S.time = S.cfg.limit; }
    }
    function gameOver() {
        state = 'over'; S.hold = 100; Z.pauseOk = false;
        S.best = Z.hi.submit('honicka', S.score); Z.snd.over();
    }

    // ---------- Kreslení
    function px2(x, z) { return 128 + (x - S.px) * F / z; }
    function gy(z) { return HOR + GH / z; }

    function drawTree(tr, pal) {
        var z = tr.z, sx = px2(tr.x, z) | 0, by = gy(z) | 0, h = (150 / z) | 0;
        if (sx < -60 || sx > 316 || h < 2) { return; }
        if (h < 6) { Z.rect(sx - 1, by - h, 2, h, pal.fol); return; }
        var tw = Math.max(1, (h / 12) | 0), th = (h * 0.28) | 0, fh = h - th, fw = Math.max(3, (h * 0.42) | 0);
        Z.rect(sx - (tw >> 1), by - th, tw, th, pal.trunk);
        var step = Math.max(1, (fh / 14) | 0);
        for (var y = 0; y < fh; y += step) {
            var f = (y / fh), w = Math.max(1, (fw * (0.25 + f * 0.75) * (1 - 0.15 * ((y / (fh / 3 | 0 || 1)) % 1))) | 0);
            Z.rect(sx - w, by - th - fh + y, w * 2, step, y % (step * 4) < step * 2 ? pal.fol : pal.fol2);
        }
    }
    function drawBike(sx, by, s, col, rider) {
        // s = měřítko (px na jednotku), motorka zezadu
        var u = Math.max(1, s);
        Z.rect(sx - u * 1, by - u * 4, u * 2, u * 4, 0);           // kolo
        Z.rect(sx - u * 2, by - u * 8, u * 4, u * 4, col);         // tělo
        Z.rect(sx - u * 1, by - u * 11, u * 2, u * 3, rider);      // jezdec
        Z.rect(sx - u * 1, by - u * 13, u * 2, u * 2, 7);          // přilba
    }
    function drawHeli(sx, by, s, flash) {
        var u = Math.max(1, s), c = flash ? 15 : 2;
        Z.rect(sx - u * 3, by - u * 4, u * 6, u * 3, c);
        Z.rect(sx + u * 3, by - u * 4, u * 4, u, c);
        Z.rect(sx - u * 1, by - u * 6, u * 2, u * 2, 8);
        Z.rect(sx - u * 6, by - u * 7, u * 12, Math.max(1, u >> 1), (t >> 1) & 1 ? 7 : 8);
    }
    function drawTank(sx, by, s, flash) {
        var u = Math.max(1, s), c = flash ? 15 : 4;
        Z.rect(sx - u * 4, by - u * 3, u * 8, u * 3, 0);
        Z.rect(sx - u * 4, by - u * 5, u * 8, u * 3, c);
        Z.rect(sx - u * 2, by - u * 8, u * 4, u * 3, 12);
        Z.rect(sx - Math.max(1, u >> 1), by - u * 10, Math.max(1, u), u * 3, 8);
    }
    function drawEnemy(e) {
        var z = e.z, sx = px2(e.x, z) | 0, by = gy(z) | 0, s = 6 / z;
        if (!e.alive) {
            if (e.flash > 0) { var r = 4 + (40 - e.flash) * 0.4; Z.disc(sx, by - 8, Math.max(2, (r * 6 / z) | 0), e.flash & 2 ? 14 : 10); }
            return;
        }
        var fl = e.flash > 0 && (e.flash & 2);
        if (e.type === 'bike') { drawBike(sx, by, s | 0 || 1, fl ? 15 : 3, 2); }
        else if (e.type === 'heli') { drawHeli(sx, (by - 40 / z) | 0, s | 0 || 1, fl); Z.rect(sx - 1, by - 1, Math.max(1, 4 / z | 0), 1, 0); }
        else { drawTank(sx, by, s | 0 || 1, fl); }
    }
    function drawWorld() {
        var p = S.cfg.pal;
        Z.rect(0, 0, 256, HOR + 1, p.sky);
        Z.rect(0, HOR, 256, 192 - HOR, p.gnd);
        if (p === PAL[2]) {
            Z.disc(200, 24, 8, 7); Z.disc(204, 22, 7, 0);
            for (var i = 0; i < 22; i++) { Z.pix((i * 71 + 13) % 256, (i * 37) % 60, i % 3 ? 7 : 14); }
        } else if (p === PAL[1]) { Z.disc(60, HOR - 4, 12, 14); Z.rect(0, HOR - 4, 256, 6, p.gnd); }
        else { Z.disc(210, 24, 7, 14); }
        // pásy na zemi pro pocit rychlosti
        S.dist = ((S.dist || 0) + S.sp) % 3;
        for (var k = 0; k < 18; k++) {
            var z = 1 + (k * 3 - S.dist + 3) % 54;
            if (z > 1 && z < MAXZ) { var y1 = gy(z) | 0, y2 = gy(z + 1.8 + z * 0.1) | 0; Z.rect(0, y2, 256, Math.max(1, (y1 - y2) >> 1), p.band); }
        }
        // objekty seřazené od nejvzdálenějšího
        var objs = S.trees.map(function (tr) { return { z: tr.z, tr: tr }; });
        S.en.forEach(function (e) { objs.push({ z: e.z, en: e }); });
        S.ebul.forEach(function (b) { objs.push({ z: b.z, b: b }); });
        S.shots.forEach(function (s) { objs.push({ z: s.z, s: s }); });
        objs.sort(function (a, b) { return b.z - a.z; });
        objs.forEach(function (o) {
            if (o.tr) { drawTree(o.tr, p); }
            else if (o.en) { drawEnemy(o.en); }
            else if (o.b) { var bx = px2(o.b.x, o.z) | 0, by = (gy(o.z) - 14 / o.z) | 0, r = Math.max(1, (4 / o.z) | 0); Z.disc(bx, by, r, (t >> 1) & 1 ? 10 : 14); }
            else { var sx = px2(o.s.x, o.z) | 0, sy = (gy(o.z) - 10 / o.z) | 0; Z.rect(sx - 1, sy - 1, 2, 3, 14); }
        });
        // hráč
        if (!(state === 'dying' && S.hold % 8 < 4) && !(S.inv > 0 && (t >> 2) & 1)) {
            var lx = (S.lean * 4) | 0, ph = (t >> 2) & 1;
            Z.rect(120 + lx, 172, 16, 4, 0);
            Z.rect(125 + lx, 176, 6, 14, 0);                  // zadní kolo
            Z.rect(123 + lx * 2, 164, 10, 10, 2);              // nádrž
            Z.rect(119 + lx * 2, 167, 3, 3, 8);
            Z.rect(134 + lx * 2, 167, 3, 3, 8);
            Z.rect(124 + lx * 2, 154, 8, 10, 1);               // jezdec
            Z.rect(125 + lx * 2, 148, 6, 6, 7);
            Z.rect(125 + lx * 2, 150, 6, 1, 9);
            Z.rect(126 + ph, 189, 4, 2, 0);
        }
        if (state === 'dying') { Z.disc(128, 170, 4 + (80 - S.hold) / 6 | 0, S.hold & 2 ? 14 : 10); }
        // zaměřovač
        if (state === 'play') { var ch = 128; Z.rect(ch - 5, 100, 4, 1, 15); Z.rect(ch + 2, 100, 4, 1, 15); Z.rect(ch, 98, 1, 5, 15); }
    }
    function hud() {
        Z.rect(0, 0, 256, 9, 0);
        Z.text(2, 1, 'SKORE ' + S.score, 14);
        Z.text(128, 1, 'KOLO ' + S.round, 15, { align: 'center' });
        Z.text(254, 1, 'ZIV ' + S.lives, 10, { align: 'right' });
        var sec = Math.ceil(S.time / 50), w = Math.max(0, Math.round(S.time / S.cfg.limit * 100));
        Z.rect(2, 183, 104, 7, 0); Z.frame(2, 183, 104, 7, 7);
        Z.rect(3, 184, w, 5, S.time < 500 ? 10 : 12);
        Z.text(110, 182, sec + 'S', 15);
        Z.rect(168, 183, 86, 7, 0);
        Z.text(254, 182, 'RYCHL ' + Math.round(S.sp * 100), 7, { align: 'right' });
    }
    function draw() {
        if (state === 'title') { return drawTitle(); }
        Z.cls(0, 7);
        drawWorld();
        hud();
        var c = S.cfg;
        if (state === 'play' && S.time > c.limit - 120) {
            var msg = c.type === 'bike' ? 'DOHON JEZDCE!' : c.type === 'heli' ? 'POZOR, VRTULNIK!' : 'SESTREL TANK!';
            Z.rect(50, 24, 156, 12, 0); Z.text(128, 26, msg, 14, { align: 'center' });
        }
        if (state === 'clear') {
            Z.rect(40, 70, 176, 36, 0); Z.frame(40, 70, 176, 36, 14);
            Z.text(128, 76, 'KOLO SPLNENO!', 14, { align: 'center' });
            Z.text(128, 90, 'BONUS ZA CAS ' + S.bonus, 15, { align: 'center' });
        }
        if (state === 'dying') {
            Z.rect(50, 70, 156, 12, 0); Z.text(128, 72, S.crashTimeout ? 'CAS VYPRSEL!' : 'NARAZ!', 10, { align: 'center' });
        }
        if (state === 'over') {
            Z.rect(36, 62, 184, 56, 0); Z.frame(36, 62, 184, 56, 10);
            Z.text(128, 68, 'KONEC HRY', 10, { align: 'center', scale: 2 });
            Z.text(128, 92, 'SKORE ' + S.score, 14, { align: 'center' });
            Z.text(128, 104, 'REKORD ' + S.best, 15, { align: 'center' });
        }
    }
    function drawTitle() {
        Z.cls(0, 7);
        var p = PAL[0];
                // ozdobné stromy
        for (var i = 0; i < 6; i++) { var z = 3 + i * 1.6, x = (i % 2 ? 1 : -1) * (4 + i * 0.8); S.px = 0; drawTree({ x: x, z: z, v: 0 }, { fol: 4, fol2: 12, trunk: 6 }); }
        Z.text(128, 14, 'LESNÍ HONIČKA', 14, { align: 'center', scale: 2 });
        Z.text(128, 36, 'DEATHCHASE V ČESKÉM LESE', 5, { align: 'center' });
        Z.rect(4, 56, 248, 62, 0); Z.frame(4, 56, 248, 62, 7);
        var L = ['DOHOŇ A SESTŘEL JEZDCE NA MOTORKÁCH,', 'POZDĚJI VRTULNÍK A TANK.', 'NARAZ DO STROMU = ZTRÁTA ŽIVOTA.', 'KOLO MÁ ČASOVÝ LIMIT.', 'ŠIPKY/WASD: ZATÁČENÍ, RYCHLOST', 'MEZERNÍK: PALBA  P: PAUZA  M: ZVUK'];
        L.forEach(function (s, j) { Z.text(128, 60 + j * 9, s, j < 4 ? 15 : 14, { align: 'center' }); });
        Z.text(128, 128, 'REKORD ' + Z.hi.get('honicka'), 14, { align: 'center' });
        if ((t >> 5) & 1) { Z.text(128, 150, 'STISKNI OHEŇ', 10, { align: 'center' }); }
        Z.rect(120, 168, 16, 4, 0);
    }

    G.S = S; G.state = function () { return state; }; G.setState = function (s) { state = s; };
    Z.run({ tick: tick, draw: draw });
})();
