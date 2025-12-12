// Windows 3.1 Program Manager

class ProgramManager {
    constructor() {
        this.zIndex = 100;
        this.currentWindow = null;
        this.minimizedWindows = new Map();
        this.init();
    }

    initDoom() {
        const canvas = document.getElementById('doom-canvas');
        const ctx = canvas.getContext('2d');
        const healthEl = document.getElementById('doom-health');
        const ammoEl = document.getElementById('doom-ammo');
        const scoreEl = document.getElementById('doom-score');
        const levelEl = document.getElementById('doom-level');
        const weaponEl = document.getElementById('doom-weapon');
        const restartBtn = document.getElementById('doom-restart');
        const gunImg = new Image();
        gunImg.src = 'assets/gun.png';
        let gunLoaded = false;
        gunImg.onload = () => gunLoaded = true;

        // Canvas dimensions
        const W = canvas.width;
        const H = canvas.height;

        // Simple map (1=wall, 0=floor) - less maze-like, more rooms
        const map = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],
            [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];
        const mapW = map[0].length;
        const mapH = map.length;

        const fov = Math.PI / 3; // 60 deg
        const numRays = W;
        const depth = 20;

        let player = {
            x: 2.5,
            y: 2.5,
            dir: 0,
            health: 100,
            ammo: 30,
            score: 0,
            alive: true
        };

        let enemies = [];
        let bullets = [];
        let overlayMode = null; // 'level', 'dead' or null

        const keys = { w:false, a:false, s:false, d:false, q:false, e:false, space:false };

        let level = 1;
        let weapon = { name: 'Pistol', damage: 1, ammoUse: 1 };

        function isWall(x, y) {
            const ix = Math.floor(x);
            const iy = Math.floor(y);
            if (ix < 0 || iy < 0 || ix >= mapW || iy >= mapH) return true;
            return map[iy][ix] === 1;
        }

        function updateHUD() {
            healthEl.textContent = `Health: ${player.health}`;
            ammoEl.textContent = `Ammo: ${player.ammo}`;
            scoreEl.textContent = `Score: ${player.score}`;
            levelEl.textContent = `Level: ${level}`;
            weaponEl.textContent = `Weapon: ${weapon.name}`;
        }

        function castRays(depthBuffer) {
            for (let col = 0; col < numRays; col++) {
                const rayAngle = (player.dir - fov/2) + (col / numRays) * fov;
                let distToWall = 0;
                let hitWall = false;

                const eyeX = Math.cos(rayAngle);
                const eyeY = Math.sin(rayAngle);

                while (!hitWall && distToWall < depth) {
                    distToWall += 0.05;
                    const testX = player.x + eyeX * distToWall;
                    const testY = player.y + eyeY * distToWall;
                    if (isWall(testX, testY)) {
                        hitWall = true;
                    }
                }

                const ceiling = (H/2) - H / distToWall;
                const floor = H - ceiling;
                const shade = Math.max(0, 1 - distToWall / depth);
                ctx.fillStyle = `rgba(150,0,0,${shade})`;
                ctx.fillRect(col, ceiling, 1, floor - ceiling);
                // floor
                ctx.fillStyle = `rgba(40,40,40,1)`;
                ctx.fillRect(col, floor, 1, H - floor);

                depthBuffer[col] = distToWall;
            }
        }

        function renderSprites(depthBuffer) {
            const sprites = enemies
                .filter(en => en.alive)
                .map(en => {
                    const dx = en.x - player.x;
                    const dy = en.y - player.y;
                    const dist = Math.hypot(dx, dy);
                    const angleTo = Math.atan2(dy, dx) - player.dir;
                    // normalize angle
                    const a = ((angleTo + Math.PI) % (2*Math.PI)) - Math.PI;
                    return {en, dist, angle: a};
                })
                .filter(s => Math.abs(s.angle) < fov/2 && s.dist > 0.2) // in view
                .sort((a,b) => b.dist - a.dist); // far to near

            sprites.forEach(s => {
                const size = Math.min(120, H / s.dist);
                const screenX = (s.angle + fov/2) / fov * W;
                const x0 = screenX - size/2;
                const y0 = H/2 - size/2;
                
                // Draw monster with more detail (body, eyes, mouth)
                ctx.save();
                // Body - dark green/brown demon
                for (let x = 0; x < size; x++) {
                    const sx = Math.floor(x0 + x);
                    if (sx < 0 || sx >= W) continue;
                    if (depthBuffer[sx] < s.dist) continue;
                    
                    const relX = x / size; // 0 to 1
                    // Body shape (wider in middle)
                    const bodyAlpha = relX > 0.2 && relX < 0.8 ? 1 : 0.6;
                    ctx.fillStyle = `rgba(100,40,20,${bodyAlpha})`;
                    ctx.fillRect(sx, y0, 1, size);
                }
                
                // Eyes (glowing red)
                const eyeSize = Math.max(2, size * 0.15);
                const eyeY = y0 + size * 0.3;
                const eyeLeft = x0 + size * 0.3;
                const eyeRight = x0 + size * 0.7;
                
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(eyeLeft, eyeY, eyeSize, eyeSize);
                ctx.fillRect(eyeRight, eyeY, eyeSize, eyeSize);
                
                // Mouth (dark)
                const mouthY = y0 + size * 0.65;
                const mouthW = size * 0.4;
                const mouthH = size * 0.15;
                ctx.fillStyle = '#000';
                ctx.fillRect(x0 + size * 0.3, mouthY, mouthW, mouthH);
                
                // Health bar (only when recently hit)
                const en = s.en;
                if (en && en.showHealthTimer > 0 && en.maxHp) {
                    const barWidth = size * 0.6;
                    const barHeight = 5;
                    const barX = x0 + size/2 - barWidth/2;
                    const barY = y0 - 8;
                    const ratio = Math.max(0, Math.min(1, en.hp / en.maxHp));
                    // background
                    ctx.fillStyle = 'rgba(60,0,0,0.8)';
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                    // fill
                    ctx.fillStyle = 'rgba(0,200,0,0.9)';
                    ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
                    // border
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(barX, barY, barWidth, barHeight);
                }
                
                ctx.restore();
            });
        }

        function renderGun() {
            const gunW = gunLoaded ? 220 : 120;
            const gunH = gunLoaded ? 160 : 90;
            const x = W/2 - gunW/2;
            const y = H - gunH + 10;
            if (gunLoaded) {
                ctx.drawImage(gunImg, x, y, gunW, gunH);
            } else {
                ctx.fillStyle = '#444';
                ctx.fillRect(x, y, gunW, gunH);
                ctx.fillStyle = '#888';
                ctx.fillRect(x+6, y+10, gunW-12, gunH-20);
                ctx.fillStyle = '#222';
                ctx.fillRect(x+gunW/2-6, y-6, 12, 12);
            }
        }

        function movePlayer(dt) {
            const moveSpeed = 2.5 * dt;
            const rotSpeed = 2.2 * dt;
            if (keys.q) player.dir -= rotSpeed;
            if (keys.e) player.dir += rotSpeed;

            let dx = 0, dy = 0;
            if (keys.w) { dx += Math.cos(player.dir) * moveSpeed; dy += Math.sin(player.dir) * moveSpeed; }
            if (keys.s) { dx -= Math.cos(player.dir) * moveSpeed; dy -= Math.sin(player.dir) * moveSpeed; }
            if (keys.a) { dx += Math.cos(player.dir - Math.PI/2) * moveSpeed; dy += Math.sin(player.dir - Math.PI/2) * moveSpeed; }
            if (keys.d) { dx += Math.cos(player.dir + Math.PI/2) * moveSpeed; dy += Math.sin(player.dir + Math.PI/2) * moveSpeed; }

            const nx = player.x + dx;
            const ny = player.y + dy;
            if (!isWall(nx, player.y)) player.x = nx;
            if (!isWall(player.x, ny)) player.y = ny;
        }

        function spawnEnemiesForLevel() {
            enemies = [];
            const count = Math.min(10, 2 + level * 2);
            for (let i = 0; i < count; i++) {
                let x = 0, y = 0;
                let tries = 0;
                do {
                    x = 2 + Math.random() * (mapW - 4);
                    y = 2 + Math.random() * (mapH - 4);
                    tries++;
                } while ((isWall(x,y) || Math.hypot(x - player.x, y - player.y) < 3) && tries < 50);
                const maxHp = 6 + level * 2; // tougher enemies each level
                enemies.push({
                    x, y,
                    alive: true,
                    hp: maxHp,
                    maxHp,
                    speed: 0.8 + level * 0.1,
                    showHealthTimer: 0
                });
            }
        }

        function updateEnemies(dt) {
            enemies.forEach((en) => {
                if (!en.alive) return;
                if (en.showHealthTimer > 0) en.showHealthTimer = Math.max(0, en.showHealthTimer - dt);
                const dx = player.x - en.x;
                const dy = player.y - en.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 0.8) {
                    // Damage player
                    player.health -= 10 * dt;
                    if (player.health <= 0) {
                        player.health = 0;
                        player.alive = false;
                    }
                    // Push enemy away to avoid overlapping / clipping through player
                    const pushDist = Math.max(0.8 - dist, 0.05);
                    const norm = dist > 0.0001 ? dist : 1;
                    const pushX = (dx / norm) * pushDist * 0.6;
                    const pushY = (dy / norm) * pushDist * 0.6;
                    const nx = en.x - pushX;
                    const ny = en.y - pushY;
                    if (!isWall(nx, en.y)) en.x = nx;
                    if (!isWall(en.x, ny)) en.y = ny;
                } else {
                    const speed = en.speed * dt;
                    const stepX = dx / dist * speed;
                    const stepY = dy / dist * speed;
                    const nx = en.x + stepX;
                    const ny = en.y + stepY;
                    if (!isWall(nx, en.y)) en.x = nx;
                    if (!isWall(en.x, ny)) en.y = ny;
                }
            });
        }

        function allEnemiesDead() {
            return enemies.every(en => !en.alive);
        }

        function nextLevel() {
            level++;
            // Reward
            player.ammo += 10;
            player.health = Math.min(100, player.health + 20);
            // Upgrade weapon every 2 levels
            if (level === 2) weapon = { name: 'Shotgun', damage: 2, ammoUse: 1 };
            if (level === 4) weapon = { name: 'Chaingun', damage: 1, ammoUse: 0.5 };
            spawnEnemiesForLevel();
        }

        // Overlay handling
        const overlay = document.getElementById('doom-overlay');
        const overlayTitle = document.getElementById('doom-overlay-title');
        const overlayBody = document.getElementById('doom-overlay-body');
        const overlayActions = document.getElementById('doom-overlay-actions');
        const startBtn = document.getElementById('doom-start');
        const nextBtn = document.getElementById('doom-next-level');
        const buyAmmoBtn = document.getElementById('doom-buy-ammo');
        const restartOverlayBtn = document.getElementById('doom-restart-overlay');

        function showOverlay(type) {
            overlayMode = type;
            if (!overlay) return;
            document.exitPointerLock && document.exitPointerLock();
            if (type === 'start') {
                overlayTitle.textContent = 'Misha Doom';
                overlayBody.textContent = 'Click Start to begin';
                startBtn.style.display = 'inline-block';
                nextBtn.style.display = 'none';
                buyAmmoBtn.style.display = 'none';
                restartOverlayBtn.style.display = 'none';
            } else if (type === 'level') {
                overlayTitle.textContent = 'Level Cleared';
                overlayBody.textContent = 'Choose next action';
                startBtn.style.display = 'none';
                nextBtn.style.display = 'inline-block';
                buyAmmoBtn.style.display = 'inline-block';
                restartOverlayBtn.style.display = 'inline-block';
            } else if (type === 'dead') {
                overlayTitle.textContent = 'YOU DIED';
                overlayBody.textContent = 'The darkness consumes you. Restart?';
                startBtn.style.display = 'none';
                nextBtn.style.display = 'none';
                buyAmmoBtn.style.display = 'none';
                restartOverlayBtn.style.display = 'inline-block';
            }
            overlay.style.display = 'flex';
        }

        function hideOverlay() {
            overlayMode = null;
            if (overlay) overlay.style.display = 'none';
        }

        function shoot() {
            if (player.ammo <= 0) return;
            player.ammo -= weapon.ammoUse;
            const speed = 18; // faster, longer range
            const isShotgun = weapon.name === 'Shotgun';
            const isChaingun = weapon.name === 'Chaingun';
            const pelletCount = isShotgun ? 10 : isChaingun ? 3 : 1;
            const spread = isShotgun ? 0.8 : isChaingun ? 0.18 : 0.05; // much wider bloom for shotgun
            const shotBloom = (Math.random() - 0.5) * 0.2; // per-shot base bloom to fan out the blast
            for (let i = 0; i < pelletCount; i++) {
                const pelletBloom = (Math.random() - 0.5) * spread;
                const angleJitter = shotBloom + pelletBloom;
                bullets.push({
                    x: player.x,
                    y: player.y,
                    dir: player.dir + angleJitter,
                    speed,
                    alive: true
                });
            }
        }

        function updateBullets(dt) {
            bullets = bullets.filter(b => b.alive);
            bullets.forEach(b => {
                const nx = b.x + Math.cos(b.dir) * b.speed * dt;
                const ny = b.y + Math.sin(b.dir) * b.speed * dt;
                if (isWall(nx, ny)) { b.alive = false; return; }
                b.x = nx; b.y = ny;
                // hit enemy?
                enemies.forEach(en => {
                    if (!en.alive) return;
                    const dist = Math.hypot(en.x - b.x, en.y - b.y);
                    if (dist < 1.0) { // larger hit radius so distant shots still connect
                        // Distance-based damage falloff: close = full, far = reduced (no one-shots from afar)
                        const falloff = Math.max(0.35, 1 - (dist / 8)); // beyond ~8 units trims to 35%
                        const dmg = weapon.damage * falloff;
                        en.hp -= dmg;
                        en.showHealthTimer = 2; // show health bar after being hit
                        if (en.hp <= 0) {
                            en.alive = false;
                            player.score += 50;
                        }
                        b.alive = false;
                    }
                });
            });
            bullets = bullets.filter(b => b.alive);
        }

        function renderBullets(depthBuffer) {
            bullets.forEach(b => {
                const dx = b.x - player.x;
                const dy = b.y - player.y;
                const dist = Math.hypot(dx, dy);
                const angleTo = Math.atan2(dy, dx) - player.dir;
                const a = ((angleTo + Math.PI) % (2*Math.PI)) - Math.PI;
                if (Math.abs(a) > fov/2 || dist <= 0.1) return;
                const size = Math.max(3, Math.min(12, 55 / dist));
                const screenX = (a + fov/2) / fov * W;
                const x0 = Math.floor(screenX);
                const y0 = Math.floor(H/2 - size/2);
                // splatter: multiple sparks around the shot line
                const sparks = 4 + Math.floor(Math.random() * 3);
                for (let i = 0; i < sparks; i++) {
                    const jitterX = (Math.random() - 0.5) * size * 0.8;
                    const jitterY = (Math.random() - 0.5) * size * 0.6;
                    const sx = Math.floor(x0 + jitterX);
                    const sy = Math.floor(y0 + jitterY);
                    if (sx < 0 || sx >= W) continue;
                    if (depthBuffer[sx] < dist) continue;
                    const sparkSize = Math.max(2, size * 0.4);
                    const grad = ctx.createLinearGradient(0, sy, 0, sy + sparkSize);
                    grad.addColorStop(0, 'rgba(255,235,59,0.95)');
                    grad.addColorStop(1, 'rgba(255,120,0,0.75)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(sx, sy, 2, sparkSize);
                }
            });
        }

        let lastTime = performance.now();
        function loop(ts) {
            const dt = Math.min(0.05, (ts - lastTime) / 1000);
            lastTime = ts;
            if (player.alive && !overlayMode) {
                movePlayer(dt);
                updateEnemies(dt);
                updateBullets(dt);
                if (player.health <= 0) {
                    player.health = 0;
                    player.alive = false;
                }
                if (allEnemiesDead()) {
                    showOverlay('level');
                } else if (!player.alive) {
                    showOverlay('dead');
                }
            }
            ctx.fillStyle = '#000';
            ctx.fillRect(0,0,W,H);
            const depthBuffer = new Array(numRays).fill(depth);
            castRays(depthBuffer);
            renderSprites(depthBuffer);
            renderBullets(depthBuffer);
            renderGun();
            updateHUD();
            requestAnimationFrame(loop);
        }

        function requestPointerLock() {
            if (canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }
        }

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === canvas) {
                const sensitivity = 0.0025;
                player.dir += e.movementX * sensitivity;
            }
        });

        canvas.addEventListener('click', () => {
            requestPointerLock();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = true;
            if (e.key === 'a' || e.key === 'A') keys.a = true;
            if (e.key === 's' || e.key === 'S') keys.s = true;
            if (e.key === 'd' || e.key === 'D') keys.d = true;
            if (e.key === 'q' || e.key === 'Q') keys.q = true;
            if (e.key === 'e' || e.key === 'E') keys.e = true;
            if (e.code === 'Space') {
                keys.space = true;
                shoot();
            }
            if (e.key === 'f' || e.key === 'F') {
                shoot();
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'w' || e.key === 'W') keys.w = false;
            if (e.key === 'a' || e.key === 'A') keys.a = false;
            if (e.key === 's' || e.key === 'S') keys.s = false;
            if (e.key === 'd' || e.key === 'D') keys.d = false;
            if (e.key === 'q' || e.key === 'Q') keys.q = false;
            if (e.key === 'e' || e.key === 'E') keys.e = false;
            if (e.code === 'Space') keys.space = false;
        });

        function startNewRun() {
            player = {
                x: 2.5,
                y: 2.5,
                dir: 0,
                health: 100,
                ammo: 30,
                score: 0,
                alive: true
            };
            level = 1;
            weapon = { name: 'Pistol', damage: 1, ammoUse: 1 };
            bullets = [];
            hideOverlay();
            spawnEnemiesForLevel();
        }

        restartBtn.addEventListener('click', () => {
            startNewRun();
        });

        nextBtn?.addEventListener('click', () => {
            hideOverlay();
            nextLevel();
        });

        buyAmmoBtn?.addEventListener('click', () => {
            const cost = 20;
            if (player.score >= cost) {
                player.score -= cost;
                player.ammo += 20;
                updateHUD();
            }
        });

        restartOverlayBtn?.addEventListener('click', () => {
            startNewRun();
        });

        startBtn?.addEventListener('click', () => {
            startNewRun();
        });

        // Show start screen initially
        showOverlay('start');

        loop(performance.now());
    }

    init() {
        this.setupGroupIcons();
        this.setupProgramIcons();
        this.setupSystemMenu();
        this.setupClickOutside();
        this.setupProgramManagerControls();
        this.setupDesktopIcons();
        this.setupStatusBarControls();
        this.setupDesktopClickDeselect();
        this.setupVhsHotspot();
        this.updateStatusBar();
        setInterval(() => this.updateStatusBar(), 1000);
    }

    setupVhsHotspot() {
        const hotspot = document.getElementById('vhs-hotspot');
        if (!hotspot) return;

        this.vhsPlayer = {
            playlist: [],
            lastIndex: -1,
            audio: null,
            insertSound: null,
            isPlaying: false
        };

        // Load the VHS insertion sound effect
        this.vhsPlayer.insertSound = new Audio('sounds/VHS Tape Going Into VHS Player sound effect.mp3');
        this.vhsPlayer.insertSound.volume = 0.4;
        this.vhsPlayer.insertSound.preload = 'auto';

        // Set up the playlist with the songs
        this.setVhsPlaylist([
            'sounds/Billy Ray Cyrus - Achy Breaky Heart  Lyrics.mp3',
            'sounds/En Vogue - My Lovin\' (You\'re Never Gonna Get It) (Official Music Video) [HD].mp3',
            'sounds/Kome Kome Club - True Heart  kimi ga iru dakede.mp3',
            'sounds/SNAP! - Rhythm Is A Dancer (Official Music Video).mp3',
            'sounds/Алла Пугачёва - Беглец (Official Video) [Рождественские встречи].mp3',
            'sounds/Группа крови.mp3',
            'sounds/悲しみは雪のように浜田 省吾.mp3'
        ]);

        hotspot.addEventListener('click', () => {
            if (this.vhsPlayer.isPlaying) {
                // If playing, stop it with VHS sound
                this.stopVhsWithSound();
            } else {
                // If not playing, start with VHS sound
                this.playVhsInsertSound();
            }
        });
    }

    playVhsInsertSound() {
        if (!this.vhsPlayer || !this.vhsPlayer.insertSound) return;

        try {
            // Wait for metadata to load to get duration
            if (this.vhsPlayer.insertSound.readyState < 2) {
                this.vhsPlayer.insertSound.addEventListener('loadedmetadata', () => {
                    this.playVhsInsertSoundFromMiddle(true);
                });
                this.vhsPlayer.insertSound.load();
                return;
            }
            this.playVhsInsertSoundFromMiddle(true);
        } catch (e) {
            console.log('Error playing VHS sound:', e);
            // If sound fails, just play music
            this.playRandomVhsTrack();
        }
    }

    stopVhsWithSound() {
        // First stop the music (with fade out)
        this.stopVhsTrack();
        
        // Then play VHS sound after a short delay to let fade out start
        setTimeout(() => {
            if (!this.vhsPlayer || !this.vhsPlayer.insertSound) return;

            try {
                // Wait for metadata to load to get duration
                if (this.vhsPlayer.insertSound.readyState < 2) {
                    this.vhsPlayer.insertSound.addEventListener('loadedmetadata', () => {
                        this.playVhsInsertSoundFromMiddle(false);
                    });
                    this.vhsPlayer.insertSound.load();
                    return;
                }
                this.playVhsInsertSoundFromMiddle(false);
            } catch (e) {
                console.log('Error playing VHS sound:', e);
            }
        }, 100); // Small delay to let fade out begin
    }

    playVhsInsertSoundFromMiddle(shouldPlayMusic) {
        try {
            const duration = this.vhsPlayer.insertSound.duration;
            // Start from middle of the sound (about 40% through)
            const startTime = duration * 0.4;
            this.vhsPlayer.insertSound.currentTime = startTime;
            this.vhsPlayer.insertSound.play().then(() => {
                // Stop after 2 seconds for going in, 1.5 seconds for taking out
                const playDuration = shouldPlayMusic ? 2000 : 1500;
                setTimeout(() => {
                    this.vhsPlayer.insertSound.pause();
                    this.vhsPlayer.insertSound.currentTime = 0;
                    if (shouldPlayMusic) {
                        // Start playing music after sound effect
                        this.playRandomVhsTrack();
                    }
                    // If shouldPlayMusic is false, music was already stopped, just play the sound
                }, playDuration);
            }).catch(e => {
                console.log('Error playing VHS sound:', e);
                if (shouldPlayMusic) {
                    this.playRandomVhsTrack();
                }
            });
        } catch (e) {
            console.log('Error playing VHS sound from middle:', e);
            if (shouldPlayMusic) {
                this.playRandomVhsTrack();
            }
        }
    }

    stopVhsTrack() {
        if (this.vhsPlayer && this.vhsPlayer.audio) {
            const audio = this.vhsPlayer.audio;
            // Fade out before stopping
            const fadeOutDuration = 500; // 0.5 seconds fade out
            const fadeOutSteps = 20;
            const fadeOutInterval = fadeOutDuration / fadeOutSteps;
            let currentStep = 0;
            const startVolume = audio.volume;

            const fadeOutIntervalId = setInterval(() => {
                currentStep++;
                const targetVolume = startVolume * (1 - currentStep / fadeOutSteps);
                audio.volume = Math.max(targetVolume, 0);
                
                if (currentStep >= fadeOutSteps) {
                    clearInterval(fadeOutIntervalId);
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = 1; // Reset volume for next play
                }
            }, fadeOutInterval);
        }
        this.vhsPlayer.isPlaying = false;
    }

    setVhsPlaylist(tracks) {
        if (!Array.isArray(tracks) || tracks.length === 0) {
            console.warn('VHS playlist is empty or invalid. Provide an array of audio URLs.');
            return;
        }
        this.vhsPlayer = this.vhsPlayer || { audio: null };
        this.vhsPlayer.playlist = tracks.slice();
        this.vhsPlayer.lastIndex = -1;
    }

    playRandomVhsTrack() {
        if (!this.vhsPlayer || !Array.isArray(this.vhsPlayer.playlist) || this.vhsPlayer.playlist.length === 0) {
            console.warn('No VHS playlist set. Call setVhsPlaylist([...]) with your tracks.');
            return;
        }

        // Stop any current audio
        if (this.vhsPlayer.audio) {
            this.vhsPlayer.audio.pause();
            this.vhsPlayer.audio.currentTime = 0;
        }

        let idx = 0;
        const { playlist, lastIndex } = this.vhsPlayer;
        if (playlist.length > 1) {
            do {
                idx = Math.floor(Math.random() * playlist.length);
            } while (idx === lastIndex);
        }
        this.vhsPlayer.lastIndex = idx;

        const src = playlist[idx];
        const audio = new Audio(src);
        this.vhsPlayer.audio = audio;

        // Fade in functionality
        audio.volume = 0;
        const fadeInDuration = 2000; // 2 seconds fade in
        const fadeInSteps = 50;
        const fadeInInterval = fadeInDuration / fadeInSteps;
        let currentStep = 0;

        audio.addEventListener('ended', () => {
            this.vhsPlayer.audio = null;
            this.vhsPlayer.isPlaying = false;
            // Auto-play next track when current ends (ensures songs alternate)
            if (this.vhsPlayer.playlist && this.vhsPlayer.playlist.length > 0) {
                this.playRandomVhsTrack();
            }
        });

        audio.play().then(() => {
            this.vhsPlayer.isPlaying = true;
            // Start fade in
            const fadeInIntervalId = setInterval(() => {
                currentStep++;
                const targetVolume = currentStep / fadeInSteps;
                audio.volume = Math.min(targetVolume, 1);
                
                if (currentStep >= fadeInSteps) {
                    clearInterval(fadeInIntervalId);
                    audio.volume = 1; // Ensure it's at full volume
                }
            }, fadeInInterval);
        }).catch(err => {
            console.error('Error playing VHS track:', err);
            this.vhsPlayer.audio = null;
            this.vhsPlayer.isPlaying = false;
        });
    }

    setupDesktopClickDeselect() {
        // Deselect icons when clicking on windows, taskbar, status bar, or empty desktop
        document.addEventListener('click', (e) => {
            // Don't deselect if clicking on an icon itself or its menu
            if (e.target.closest('.desktop-icon') || 
                e.target.closest('.minimized-program-manager') ||
                e.target.closest('#desktop-icon-menu') ||
                e.target.closest('.taskbar-item') ||
                e.target.closest('#taskbar-item-menu')) {
                return;
            }
            
            // Hide context menus if clicking elsewhere
            this.hideDesktopIconMenu();
            this.hideTaskbarItemMenu();
            
            // Deselect taskbar items
            document.querySelectorAll('.taskbar-item').forEach(item => item.classList.remove('selected'));
            
            // Deselect when clicking on windows, taskbar, status bar, or desktop
            if (e.target.closest('.window') || 
                e.target.closest('.desktop-taskbar') || 
                e.target.closest('.desktop-status-bar') ||
                e.target.closest('.program-manager') ||
                e.target.classList.contains('win31-desktop') ||
                e.target.classList.contains('screen-content')) {
                document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
            }
        });
    }

    setupStatusBarControls() {
        // Volume control
        const volumeControl = document.getElementById('volume-control');
        const volumeValue = document.getElementById('volume-value');
        let volume = 100;
        let isMuted = false;

        // Create volume dropdown
        const volumeDropdown = document.createElement('div');
        volumeDropdown.className = 'volume-dropdown';
        volumeDropdown.id = 'volume-dropdown';
        volumeDropdown.innerHTML = `
            <div class="volume-slider-container">
                <div class="volume-slider-label">Volume: <span id="volume-display">100%</span></div>
                <input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="100" />
                <button class="volume-mute-btn" id="volume-mute-btn">Mute</button>
            </div>
        `;
        document.querySelector('.screen-content').appendChild(volumeDropdown);

        const volumeSlider = document.getElementById('volume-slider');
        const volumeDisplay = document.getElementById('volume-display');
        const muteBtn = document.getElementById('volume-mute-btn');

        volumeControl.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('volume-dropdown');
            const rect = volumeControl.getBoundingClientRect();
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            
            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            } else {
                dropdown.style.left = (rect.left - screenRect.left) + 'px';
                dropdown.style.bottom = (screenRect.bottom - rect.top + 4) + 'px';
                dropdown.style.display = 'block';
            }
        });

        volumeSlider.addEventListener('input', (e) => {
            volume = parseInt(e.target.value);
            if (!isMuted) {
                volumeValue.textContent = volume + '%';
                volumeDisplay.textContent = volume + '%';
                volumeControl.querySelector('.status-icon').textContent = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
            }
        });

        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                volumeValue.textContent = 'Muted';
                volumeDisplay.textContent = 'Muted';
                volumeControl.querySelector('.status-icon').textContent = '🔇';
                muteBtn.textContent = 'Unmute';
            } else {
                volumeValue.textContent = volume + '%';
                volumeDisplay.textContent = volume + '%';
                volumeControl.querySelector('.status-icon').textContent = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
                muteBtn.textContent = 'Mute';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!volumeControl.contains(e.target) && !volumeDropdown.contains(e.target)) {
                volumeDropdown.style.display = 'none';
            }
        });
    }

    setupDesktopIcons() {
        const aiIcon = document.getElementById('ai-assistant-icon');
        if (aiIcon) {
            // Single click to select and show context menu
            aiIcon.addEventListener('click', (e) => {
                // Don't show menu if in move mode (clicking to place)
                if (aiIcon.dataset.moveMode) {
                    return;
                }
                
                // Only select if we didn't just drag
                if (window.aiIconDragging === true) {
                    window.aiIconDragging = false;
                    return;
                }
                
                // Deselect all desktop icons and minimized program manager
                document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
                aiIcon.classList.add('selected');
                
                // Show context menu
                this.showDesktopIconMenu(aiIcon, 'ai-assistant');
                e.stopPropagation();
            });
            
            // Double click to open
            aiIcon.addEventListener('dblclick', () => {
                this.hideDesktopIconMenu();
                this.openAIAssistant();
            });
            
            // Don't setup drag by default - only when Move is selected
        }
        
        // Don't setup drag for minimized Program Manager by default
    }

    setupIconDrag(icon) {
        // Only allow drag if move mode is enabled
        if (!icon.dataset.moveMode) {
            return;
        }
        
        // Make icon follow cursor automatically
        const mousemoveHandler = (e) => {
            if (!icon.dataset.moveMode) {
                document.removeEventListener('mousemove', mousemoveHandler);
                return;
            }
            
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            
            // Calculate new position - center icon on cursor
            let newLeft = e.clientX - screenRect.left - (icon.offsetWidth / 2);
            let newTop = e.clientY - screenRect.top - (icon.offsetHeight / 2);
            
            // Constrain to screen bounds
            const maxX = screenContent.offsetWidth - icon.offsetWidth;
            const maxY = screenContent.offsetHeight - icon.offsetHeight - 24; // Account for status bar
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            icon.style.left = newLeft + 'px';
            icon.style.top = newTop + 'px';
            icon.style.position = 'absolute';
        };
        
        document.addEventListener('mousemove', mousemoveHandler);
        
        // Click to place (exit move mode) - prevent menu from showing
        const clickHandler = (e) => {
            if (icon.dataset.moveMode) {
                e.stopPropagation();
                e.preventDefault();
                delete icon.dataset.moveMode;
                icon.style.cursor = '';
                icon.classList.remove('selected');
                document.body.classList.remove('move-mode-active');
                document.removeEventListener('mousemove', mousemoveHandler);
                document.removeEventListener('click', clickHandler, true);
                // Clear dragging flag
                if (icon.id === 'ai-assistant-icon') {
                    window.aiIconDragging = false;
                } else if (icon.id === 'program-manager-minimized') {
                    window.pmIconDragging = false;
                }
            }
        };
        
        // Use capture phase to intercept click before it reaches icon handlers
        document.addEventListener('click', clickHandler, true);
    }

    setupMinimizedProgramManagerDrag() {
        // This will be called when Program Manager is minimized
        // We'll set it up in minimizeProgramManager
    }

    openAIAssistant() {
        const aiApp = document.getElementById('ai-assistant-app');
        if (!aiApp) return;

        if (aiApp.style.display === 'none' || !aiApp.style.display) {
            aiApp.style.display = 'flex';
            
            // Position flush with bottom-right corner, above status bar
            const screenContent = document.querySelector('.screen-content');
            const statusBar = document.querySelector('.desktop-status-bar');
            const offset = 8; // Small padding from edges
            const windowWidth = 500;
            const windowHeight = 400;
            
            // Calculate position so bottom-right corner is flush with viewport, above status bar
            const screenRect = screenContent.getBoundingClientRect();
            const statusBarHeight = statusBar ? statusBar.offsetHeight : 0;
            const left = screenRect.width - windowWidth - offset;
            const top = screenRect.height - windowHeight - statusBarHeight - offset;
            
            aiApp.style.left = `${left}px`;
            aiApp.style.top = `${top}px`;
            aiApp.style.width = `${windowWidth}px`;
            aiApp.style.height = `${windowHeight}px`;
            
            this.setupWindowDrag(aiApp);
            this.setupSingleWindowControls(aiApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('ai-assistant-app');
            
            // Setup AI assistant functionality
            this.setupAIAssistant();
        }
        
        this.focusWindow(aiApp);
    }

    setupAIAssistant() {
        const aiApp = document.getElementById('ai-assistant-app');
        if (aiApp.dataset.setup) return;
        aiApp.dataset.setup = 'true';

        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const chatArea = document.getElementById('ai-chat-area');

        const sendMessage = () => {
            const query = input.value.trim();
            if (!query) return;

            // Add user message
            const userMsg = document.createElement('div');
            userMsg.className = 'ai-message ai-user';
            userMsg.innerHTML = `<div class="message-text">${query}</div>`;
            chatArea.appendChild(userMsg);

            // Clear input
            input.value = '';

            // Scroll to bottom
            chatArea.scrollTop = chatArea.scrollHeight;

            // Simulate AI response (retro style)
            setTimeout(() => {
                const aiMsg = document.createElement('div');
                aiMsg.className = 'ai-message ai-assistant';
                const responses = [
                    "That's an interesting question! In the retro computing era, we would have consulted manuals and documentation.",
                    "Processing your request... Please wait while I search through my knowledge base.",
                    "I'm a retro AI assistant from the Windows 3.1 era. My capabilities are limited compared to modern AI, but I'll do my best!",
                    "Let me check my database... Hmm, that's a complex query. Would you like me to search for more information?",
                    "In the classic computing days, we relied on command-line interfaces and text-based systems. Your question reminds me of those times!",
                    "I'm processing your request using vintage algorithms. This might take a moment...",
                    "That's a great question! Unfortunately, as a retro AI, I don't have access to real-time web search, but I can help with general knowledge.",
                ];
                const response = responses[Math.floor(Math.random() * responses.length)];
                aiMsg.innerHTML = `<div class="message-text">${response}</div>`;
                chatArea.appendChild(aiMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 500);
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    updateStatusBar() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
        
        const timeElement = document.getElementById('status-time');
        if (timeElement) {
            timeElement.textContent = `${displayHours}:${minutes} ${ampm}`;
        }
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayName = days[now.getDay()];
        const monthName = months[now.getMonth()];
        const date = now.getDate();
        const year = now.getFullYear();
        
        const dateElement = document.getElementById('status-date');
        if (dateElement) {
            dateElement.textContent = `${dayName}, ${monthName} ${date}, ${year}`;
        }
    }

    setupProgramManagerControls() {
        const programManager = document.querySelector('.program-manager');
        if (!programManager) return;

        const systemMenuBtn = programManager.querySelector('.system-menu');
        const buttons = programManager.querySelectorAll('.window-btn');
        const minimizeBtn = buttons[0];
        const maximizeBtn = buttons[1];

        // System menu button - show dropdown
        if (systemMenuBtn) {
            systemMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('system-menu-dropdown');
                if (dropdown.style.display === 'block' && this.currentWindow === programManager) {
                    this.hideSystemMenu();
                } else {
                    this.showSystemMenu(programManager, systemMenuBtn);
                }
            });
        }

        // Minimize button - minimize to icon
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimizeProgramManager();
            });
        }

        // Maximize button
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Program Manager is already maximized by default
            });
        }
    }

    minimizeProgramManager() {
        const programManager = document.querySelector('.program-manager');
        programManager.style.display = 'none';
        
        // Deselect any currently selected group icons
        document.querySelectorAll('.group-icon').forEach(i => i.classList.remove('selected'));
        
        // Show minimized icon at top left of desktop
        let minimizedIcon = document.getElementById('program-manager-minimized');
        if (!minimizedIcon) {
            minimizedIcon = document.createElement('div');
            minimizedIcon.id = 'program-manager-minimized';
            minimizedIcon.className = 'minimized-program-manager group-icon';
            minimizedIcon.innerHTML = `
                <div class="minimized-icon-image group-icon-image">
                    <div class="mini-window-icon"></div>
                </div>
                <div class="minimized-icon-label group-icon-label">Program Manager</div>
            `;
            // Single click to select and show context menu
            minimizedIcon.addEventListener('click', (e) => {
                // Don't show menu if in move mode (clicking to place)
                if (minimizedIcon.dataset.moveMode) {
                    return;
                }
                
                // Only select if we didn't just drag
                if (window.pmIconDragging === true) {
                    window.pmIconDragging = false;
                    return;
                }
                
                // Deselect all desktop icons and group icons
                document.querySelectorAll('.desktop-icon, .group-icon').forEach(i => i.classList.remove('selected'));
                minimizedIcon.classList.add('selected');
                
                // Show context menu
                this.showDesktopIconMenu(minimizedIcon, 'program-manager');
                e.stopPropagation();
            });
            // Double click to restore
            minimizedIcon.addEventListener('dblclick', () => {
                this.hideDesktopIconMenu();
                this.restoreProgramManager();
            });
            const desktopIcons = document.querySelector('.desktop-icons-area');
            if (desktopIcons) {
                desktopIcons.insertBefore(minimizedIcon, desktopIcons.firstChild);
            } else {
                document.querySelector('.screen-content').appendChild(minimizedIcon);
            }
        }
        minimizedIcon.style.display = 'flex';
        
        // Don't add Program Manager to its own taskbar - it's shown as icon at top left
    }

    restoreProgramManager() {
        const programManager = document.querySelector('.program-manager');
        programManager.style.display = 'flex';
        
        const minimizedIcon = document.getElementById('program-manager-minimized');
        if (minimizedIcon) {
            minimizedIcon.style.display = 'none';
            minimizedIcon.classList.remove('selected');
        }
    }

    addToTaskbar(windowId, title, window) {
        const taskbar = document.querySelector('.desktop-taskbar');
        if (!taskbar) return;
        
        // Don't add Program Manager to taskbar - it has its own icon
        if (windowId === 'program-manager') return;
        
        // Only add application windows to taskbar, not program group windows
        if (!window.classList.contains('application-window')) return;
        
        // Check if already in taskbar
        if (this.minimizedWindows.has(windowId)) return;
        
        const taskbarItem = document.createElement('div');
        taskbarItem.className = 'taskbar-item';
        taskbarItem.dataset.windowId = windowId;
        taskbarItem.innerHTML = `
            <div class="taskbar-item-image">
                <div class="mini-window-icon"></div>
            </div>
            <div class="taskbar-item-label">${title}</div>
        `;
        
        // Single click to select and show context menu
        let clickTimeout;
        taskbarItem.addEventListener('click', (e) => {
            // Clear any pending timeout
            clearTimeout(clickTimeout);
            
            // Wait a bit to see if it's a double-click
            clickTimeout = setTimeout(() => {
                // Deselect all other taskbar items
                document.querySelectorAll('.taskbar-item').forEach(item => item.classList.remove('selected'));
                taskbarItem.classList.add('selected');
                
                // Show context menu
                this.showTaskbarItemMenu(taskbarItem, windowId, window, title);
            }, 200);
            
            e.stopPropagation();
        });
        
        // Double click to restore
        taskbarItem.addEventListener('dblclick', () => {
            this.hideTaskbarItemMenu();
            this.restoreFromTaskbar(windowId, window);
        });
        
        taskbar.appendChild(taskbarItem);
        this.minimizedWindows.set(windowId, { window, taskbarItem });
    }

    removeFromTaskbar(windowId) {
        const entry = this.minimizedWindows.get(windowId);
        if (entry) {
            entry.taskbarItem.remove();
            this.minimizedWindows.delete(windowId);
        }
    }

    restoreFromTaskbar(windowId, window) {
        if (window) {
            window.style.display = 'flex';
            
            // Re-setup controls if needed
            if (window.classList.contains('program-group-window') && !window.dataset.controlsSetup) {
                this.setupSingleWindowControls(window);
                this.setupWindowDrag(window);
            }
            
            this.focusWindow(window);
            this.removeFromTaskbar(windowId);
            
        }
    }

    setupGroupIcons() {
        document.querySelectorAll('.group-icon').forEach(icon => {
            // Single click to select
            icon.addEventListener('click', (e) => {
                // Deselect all group icons including minimized Program Manager
                document.querySelectorAll('.group-icon').forEach(i => i.classList.remove('selected'));
                const minimizedPM = document.getElementById('program-manager-minimized');
                if (minimizedPM) {
                    minimizedPM.classList.remove('selected');
                }
                icon.classList.add('selected');
            });

            // Double click to open
            icon.addEventListener('dblclick', (e) => {
                const groupId = icon.dataset.group;
                this.openProgramGroup(groupId);
            });
        });
    }

    setupProgramIcons() {
        document.querySelectorAll('.program-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                document.querySelectorAll('.program-icon').forEach(i => i.classList.remove('selected'));
                icon.classList.add('selected');
            });

            icon.addEventListener('dblclick', (e) => {
                const app = icon.dataset.app;
                if (app === 'minesweeper') {
                    this.openMinesweeper();
                } else if (app === 'skifree') {
                    this.openSkiFree();
                } else if (app === 'solitaire') {
                    this.openSolitaire();
                } else if (app === 'doom') {
                    this.openDoom();
                }
            });
        });
    }

    openMinesweeper() {
        const minesweeperApp = document.getElementById('minesweeper-app');
        if (!minesweeperApp) return;

        if (minesweeperApp.style.display === 'none' || !minesweeperApp.style.display) {
            minesweeperApp.style.display = 'flex';
            minesweeperApp.style.left = `${100 + Math.random() * 100}px`;
            minesweeperApp.style.top = `${60 + Math.random() * 50}px`;
            minesweeperApp.style.width = '300px';
            this.setupWindowDrag(minesweeperApp);
            this.setupSingleWindowControls(minesweeperApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('minesweeper-app');
            
            // Initialize game if not already initialized
            if (!minesweeperApp.dataset.initialized) {
                this.initMinesweeper();
                minesweeperApp.dataset.initialized = 'true';
            }
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(minesweeperApp);
    }

    initMinesweeper() {
        const board = document.getElementById('minesweeper-board');
        const faceButton = document.getElementById('face-button');
        const mineCounter = document.getElementById('mine-counter');
        const timeCounter = document.getElementById('time-counter');
        
        const rows = 9;
        const cols = 9;
        const mines = 10;
        
        let gameBoard = [];
        let revealed = [];
        let flagged = [];
        let gameOver = false;
        let gameWon = false;
        let firstClick = true;
        let timer = 0;
        let timerInterval = null;
        
        // Initialize board
        function initBoard() {
            gameBoard = Array(rows).fill().map(() => Array(cols).fill(0));
            revealed = Array(rows).fill().map(() => Array(cols).fill(false));
            flagged = Array(rows).fill().map(() => Array(cols).fill(false));
            gameOver = false;
            gameWon = false;
            firstClick = true;
            timer = 0;
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = null;
            updateTime();
            updateMineCounter();
            faceButton.textContent = '😊';
        }
        
        // Place mines
        function placeMines(excludeRow, excludeCol) {
            let placed = 0;
            while (placed < mines) {
                const row = Math.floor(Math.random() * rows);
                const col = Math.floor(Math.random() * cols);
                if (gameBoard[row][col] !== -1 && !(row === excludeRow && col === excludeCol)) {
                    gameBoard[row][col] = -1; // -1 = mine
                    placed++;
                }
            }
            
            // Calculate numbers
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (gameBoard[r][c] !== -1) {
                        let count = 0;
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = r + dr;
                                const nc = c + dc;
                                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && gameBoard[nr][nc] === -1) {
                                    count++;
                                }
                            }
                        }
                        gameBoard[r][c] = count;
                    }
                }
            }
        }
        
        // Render board
        function renderBoard() {
            board.innerHTML = '';
            board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'minesweeper-cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    
                    if (flagged[r][c]) {
                        cell.textContent = '🚩';
                        cell.classList.add('flagged');
                    } else if (revealed[r][c]) {
                        if (gameBoard[r][c] === -1) {
                            cell.textContent = '💣';
                            cell.classList.add('mine');
                        } else if (gameBoard[r][c] > 0) {
                            cell.textContent = gameBoard[r][c];
                            cell.classList.add('number', `number-${gameBoard[r][c]}`);
                        } else {
                            cell.classList.add('empty');
                        }
                        cell.classList.add('revealed');
                    } else {
                        cell.classList.add('hidden');
                    }
                    
                    cell.addEventListener('click', (e) => handleCellClick(r, c, e));
                    cell.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        handleRightClick(r, c);
                    });
                    
                    board.appendChild(cell);
                }
            }
        }
        
        // Handle cell click
        function handleCellClick(row, col, e) {
            if (gameOver || gameWon || flagged[row][col] || revealed[row][col]) return;
            
            if (firstClick) {
                placeMines(row, col);
                firstClick = false;
                startTimer();
            }
            
            revealCell(row, col);
            checkWin();
        }
        
        // Handle right click (flag)
        function handleRightClick(row, col) {
            if (gameOver || gameWon || revealed[row][col]) return;
            
            flagged[row][col] = !flagged[row][col];
            updateMineCounter();
            renderBoard();
        }
        
        // Reveal cell
        function revealCell(row, col) {
            if (revealed[row][col] || flagged[row][col]) return;
            
            revealed[row][col] = true;
            
            if (gameBoard[row][col] === -1) {
                // Game over
                gameOver = true;
                faceButton.textContent = '😵';
                revealAllMines();
                if (timerInterval) clearInterval(timerInterval);
            } else if (gameBoard[row][col] === 0) {
                // Reveal adjacent cells
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = row + dr;
                        const nc = col + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                            revealCell(nr, nc);
                        }
                    }
                }
            }
            
            renderBoard();
        }
        
        // Reveal all mines
        function revealAllMines() {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (gameBoard[r][c] === -1) {
                        revealed[r][c] = true;
                    }
                }
            }
            renderBoard();
        }
        
        // Check win
        function checkWin() {
            let revealedCount = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (revealed[r][c]) revealedCount++;
                }
            }
            
            if (revealedCount === rows * cols - mines) {
                gameWon = true;
                gameOver = true;
                faceButton.textContent = '😎';
                if (timerInterval) clearInterval(timerInterval);
            }
        }
        
        // Start timer
        function startTimer() {
            timerInterval = setInterval(() => {
                timer++;
                updateTime();
                if (timer >= 999) {
                    clearInterval(timerInterval);
                }
            }, 1000);
        }
        
        // Update time counter
        function updateTime() {
            timeCounter.textContent = String(timer).padStart(3, '0');
        }
        
        // Update mine counter
        function updateMineCounter() {
            let flagCount = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (flagged[r][c]) flagCount++;
                }
            }
            const remaining = mines - flagCount;
            mineCounter.textContent = String(Math.max(0, remaining)).padStart(3, '0');
        }
        
        // Face button click (new game)
        faceButton.addEventListener('click', () => {
            initBoard();
            renderBoard();
        });
        
        // Initialize
        initBoard();
        renderBoard();
    }

    openSolitaire() {
        const solitaireApp = document.getElementById('solitaire-app');
        if (!solitaireApp) return;

        if (solitaireApp.style.display === 'none' || !solitaireApp.style.display) {
            solitaireApp.style.display = 'flex';
            solitaireApp.style.left = `${90 + Math.random() * 60}px`;
            solitaireApp.style.top = `${60 + Math.random() * 40}px`;
            solitaireApp.style.width = '620px';
            solitaireApp.style.height = '520px';
            this.setupWindowDrag(solitaireApp);
            this.setupSingleWindowControls(solitaireApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('solitaire-app');
            
            // Initialize game if not already initialized
            if (!solitaireApp.dataset.initialized) {
                this.initSolitaire();
                solitaireApp.dataset.initialized = 'true';
            }
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(solitaireApp);
    }

    initSolitaire() {
        const stockEl = document.getElementById('solitaire-stock');
        const wasteEl = document.getElementById('solitaire-waste');
        const foundationsEl = document.getElementById('solitaire-foundations');
        const tableauEl = document.getElementById('solitaire-tableau');
        const statusEl = document.getElementById('solitaire-status');
        const movesEl = document.getElementById('solitaire-moves');
        const newBtn = document.getElementById('solitaire-new-game');
        const resetBtn = document.getElementById('solitaire-reset');
        const timeEl = document.getElementById('solitaire-time');
        const scoreEl = document.getElementById('solitaire-score');
        const undoBtn = document.getElementById('solitaire-undo');
        const autoBtn = document.getElementById('solitaire-autocomplete');
        const drawToggleBtn = document.getElementById('solitaire-draw-toggle');

        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

        let stock = [];
        let waste = [];
        let foundations = [[],[],[],[]];
        let tableau = [[],[],[],[],[],[],[]];
        let moves = 0;
        let selected = null; // {type:'stock'|'waste'|'foundation'|'tableau', pile:index, cardIndex:index}
        let drawCount = 3; // default draw-3
        let score = 0;
        let seconds = 0;
        let timerInterval = null;
        let undoStack = [];

        function colorForSuit(suit) {
            return (suit === '♥' || suit === '♦') ? 'red' : 'black';
        }

        function startTimer() {
            clearInterval(timerInterval);
            seconds = 0;
            if (timeEl) timeEl.textContent = 'Time: 0s';
            timerInterval = setInterval(() => {
                seconds++;
                if (timeEl) timeEl.textContent = `Time: ${seconds}s`;
            }, 1000);
        }

        function stopTimer() {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        function pushUndo() {
            const snapshot = JSON.stringify({
                stock, waste, foundations, tableau, moves, score, seconds
            });
            undoStack.push(snapshot);
            if (undoStack.length > 80) undoStack.shift();
        }

        function popUndo() {
            if (!undoStack.length) return false;
            const snap = undoStack.pop();
            const state = JSON.parse(snap);
            stock = state.stock;
            waste = state.waste;
            foundations = state.foundations;
            tableau = state.tableau;
            moves = state.moves;
            score = state.score;
            seconds = state.seconds;
            if (timeEl) timeEl.textContent = `Time: ${seconds}s`;
            return true;
        }

        function buildDeck() {
            const deck = [];
            for (let s of suits) {
                for (let r of ranks) {
                    deck.push({ suit: s, rank: r, faceUp: false, id: `${r}${s}-${Math.random().toString(36).slice(2,6)}` });
                }
            }
            // shuffle
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            return deck;
        }

        function resetGame() {
            stopTimer();
            stock = buildDeck();
            waste = [];
            foundations = [[],[],[],[]];
            tableau = [[],[],[],[],[],[],[]];
            moves = 0;
            selected = null;
            score = 0;
            undoStack = [];

            // Deal tableau
            for (let col = 0; col < 7; col++) {
                for (let i = 0; i <= col; i++) {
                    const card = stock.pop();
                    card.faceUp = i === col;
                    tableau[col].push(card);
                }
            }

            render();
            statusEl.textContent = 'New Game';
            movesEl.textContent = 'Moves: 0';
            if (scoreEl) scoreEl.textContent = 'Score: 0';
            startTimer();
        }

        function canMoveToFoundation(card, foundationPile) {
            if (!card.faceUp) return false;
            const top = foundationPile[foundationPile.length - 1];
            if (!top) return card.rank === 'A';
            const sameSuit = top.suit === card.suit;
            const nextRank = ranks.indexOf(card.rank) === ranks.indexOf(top.rank) + 1;
            return sameSuit && nextRank;
        }

        function canMoveToTableau(card, destPile) {
            if (!card.faceUp) return false;
            const top = destPile[destPile.length - 1];
            if (!top) return card.rank === 'K';
            const altColor = colorForSuit(card.suit) !== colorForSuit(top.suit);
            const nextDown = ranks.indexOf(card.rank) === ranks.indexOf(top.rank) - 1;
            return altColor && nextDown;
        }

        function takeFromPile(sel, single = false) {
            if (sel.type === 'waste') return waste.pop();
            if (sel.type === 'foundation') return foundations[sel.pile].pop();
            if (sel.type === 'tableau') {
                const pile = tableau[sel.pile];
                if (single) {
                    return pile.pop();
                }
                const cards = pile.splice(sel.cardIndex);
                return cards.length === 1 ? cards[0] : cards;
            }
            return null;
        }

        function placeOnTarget(item, target) {
            // item can be single card or array (for tableau moves)
            const cards = Array.isArray(item) ? item : [item];
            const card = cards[0];
            if (target.type === 'foundation') {
                if (cards.length > 1) return false;
                const pile = foundations[target.pile];
                if (!canMoveToFoundation(card, pile)) return false;
                pile.push(card);
                return true;
            }
            if (target.type === 'tableau') {
                const pile = tableau[target.pile];
                if (!canMoveToTableau(card, pile)) return false;
                pile.push(...cards);
                return true;
            }
            return false;
        }

        function flipIfNeeded() {
            for (let pile of tableau) {
                if (pile.length > 0) {
                    const top = pile[pile.length - 1];
                    if (!top.faceUp) top.faceUp = true;
                }
            }
        }

        function drawStock() {
            if (stock.length === 0) {
                // reset stock from waste
                stock = waste.reverse().map(c => ({...c, faceUp: false}));
                waste = [];
            } else {
                for (let i = 0; i < drawCount; i++) {
                    if (stock.length === 0) break;
                    const card = stock.pop();
                    card.faceUp = true;
                    waste.push(card);
                }
                moves++;
                score -= 1;
            }
            render();
        }

        function autoMoveToFoundation(card, sourceSel) {
            for (let i = 0; i < 4; i++) {
                const pile = foundations[i];
                if (canMoveToFoundation(card, pile)) {
                    const removed = takeFromPile(sourceSel, true); // foundations only take single card
                    if (removed) {
                        pile.push(Array.isArray(removed) ? removed[0] : removed);
                        moves++;
                        score += 5;
                        flipIfNeeded();
                        render();
                        return true;
                    }
                }
            }
            return false;
        }

        function cardElement(card, opts) {
            const el = document.createElement('div');
            el.classList.add('card');
            if (!card.faceUp) el.classList.add('face-down');
            if (colorForSuit(card.suit) === 'red') el.classList.add('red');
            if (opts?.selected) el.classList.add('selected');
            el.dataset.id = card.id;
            const top = document.createElement('div');
            top.className = 'top';
            top.textContent = card.faceUp ? `${card.rank}${card.suit}` : '';
            const bottom = document.createElement('div');
            bottom.className = 'bottom';
            bottom.textContent = card.faceUp ? `${card.rank}${card.suit}` : '';
            el.appendChild(top);
            el.appendChild(bottom);
            return el;
        }

        function render() {
            statusEl.textContent = 'Playing';
            movesEl.textContent = `Moves: ${moves}`;
            if (scoreEl) scoreEl.textContent = `Score: ${score}`;
            if (drawToggleBtn) drawToggleBtn.textContent = `Draw: ${drawCount}`;

            // Stock
            stockEl.innerHTML = '';
            wasteEl.innerHTML = '';
            if (stock.length > 0) {
                const cardBack = document.createElement('div');
                cardBack.className = 'card face-down';
                cardBack.style.position = 'absolute';
                cardBack.style.top = '0';
                cardBack.style.left = '0';
                stockEl.appendChild(cardBack);
            }

            // Waste
            if (waste.length > 0) {
                const top = waste[waste.length - 1];
                const el = cardElement(top, selected?.type === 'waste' ? {selected:true}:null);
                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.left = '0';
                wasteEl.appendChild(el);
                el.addEventListener('click', () => selectCard({type:'waste'}));
                el.addEventListener('contextmenu', (e) => { e.preventDefault(); autoMoveToFoundation(top, {type:'waste'}); });
                el.addEventListener('dblclick', () => autoMoveToFoundation(top, {type:'waste'}));
            }

            // Foundations
            foundationsEl.querySelectorAll('.foundation').forEach((fEl, idx) => {
                fEl.innerHTML = '';
                const pile = foundations[idx];
                if (pile.length > 0) {
                    const top = pile[pile.length - 1];
                    const el = cardElement(top, selected?.type==='foundation' && selected.pile===idx ? {selected:true}:null);
                    el.style.position = 'absolute';
                    el.style.top = '0';
                    el.style.left = '0';
                    fEl.appendChild(el);
                    el.addEventListener('click', () => selectCard({type:'foundation', pile: idx}));
                } else {
                    fEl.innerHTML = '<div class=\"pile-placeholder\"></div>';
                }
            });

            // Tableau
            tableauEl.querySelectorAll('.tableau-pile').forEach((pileEl, idx) => {
                pileEl.innerHTML = '';
                const pile = tableau[idx];
                pile.forEach((card, cardIdx) => {
                    const isSelected = selected?.type==='tableau' && selected.pile===idx && selected.cardIndex===cardIdx;
                    const el = cardElement(card, isSelected ? {selected:true}:null);
                    el.style.top = `${cardIdx * 20}px`;
                    el.style.left = '0';
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handleTableauClick(idx, cardIdx);
                    });
                    el.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        autoMoveToFoundation(card, {type:'tableau', pile: idx, cardIndex: cardIdx});
                    });
                    pileEl.appendChild(el);
                });
            });
        }

        function selectCard(sel) {
            selected = sel;
            render();
        }

        function handleTableauClick(pileIdx, cardIdx) {
            const pile = tableau[pileIdx];
            const card = pile[cardIdx];
            // Flip if facedown and top
            if (!card.faceUp && cardIdx === pile.length -1) {
                card.faceUp = true;
                render();
                return;
            }

            if (!card.faceUp) return;

            if (!selected) {
                pushUndo();
                selected = {type:'tableau', pile: pileIdx, cardIndex: cardIdx};
                render();
                return;
            }

            // If selecting same pile top and faceDown handled above
            // Move selected to this pile
            const source = selected;
            if (source.type === 'tableau' && source.pile === pileIdx && source.cardIndex === cardIdx) {
                selected = null;
                render();
                return;
            }

            pushUndo();
            const moving = takeFromPile(source);
            if (!moving) { selected = null; render(); return; }
            if (placeOnTarget(moving, {type:'tableau', pile: pileIdx})) {
                moves++;
                flipIfNeeded();
                score -= 1;
            } else {
                // invalid, return cards
                if (Array.isArray(moving)) {
                    tableau[source.pile].splice(source.cardIndex, 0, ...moving);
                } else {
                    if (source.type === 'waste') waste.push(moving);
                    else if (source.type === 'foundation') foundations[source.pile].push(moving);
                }
            }
            selected = null;
            render();
        }

        stockEl.addEventListener('click', () => {
            drawStock();
        });

        // Clicking empty waste selects it for returning cards? We'll just ignore.

        // Clicking empty tableau pile to move selected cards
        tableauEl.querySelectorAll('.tableau-pile').forEach((pileEl, idx) => {
            pileEl.addEventListener('click', (e) => {
                if (!selected) return;
                pushUndo();
                const moving = takeFromPile(selected);
                if (!moving) { selected = null; render(); return; }
                if (placeOnTarget(moving, {type:'tableau', pile: idx})) {
                    moves++;
                    flipIfNeeded();
                    score -= 1;
                } else {
                    // invalid, return
                    if (Array.isArray(moving)) {
                        tableau[selected.pile].splice(selected.cardIndex, 0, ...moving);
                    } else {
                        if (selected.type === 'waste') waste.push(moving);
                        else if (selected.type === 'foundation') foundations[selected.pile].push(moving);
                        else if (selected.type === 'tableau') tableau[selected.pile].push(moving);
                    }
                }
                selected = null;
                render();
            });
        });

        foundationsEl.querySelectorAll('.foundation').forEach((fEl, idx) => {
            fEl.addEventListener('click', () => {
                if (!selected) return;
                pushUndo();
                const moving = takeFromPile(selected, true); // only top card
                if (!moving) { selected = null; render(); return; }
                if (placeOnTarget(moving, {type:'foundation', pile: idx})) {
                    moves++;
                    flipIfNeeded();
                    score += 5;
                } else {
                    // invalid, return
                    if (selected.type === 'waste') waste.push(moving);
                    else if (selected.type === 'foundation') foundations[selected.pile].push(moving);
                    else if (selected.type === 'tableau') tableau[selected.pile].push(moving);
                }
                selected = null;
                render();
            });
            fEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (!selected) return;
                pushUndo();
                const moving = takeFromPile(selected, true);
                if (!moving) { selected = null; render(); return; }
                if (placeOnTarget(moving, {type:'foundation', pile: idx})) {
                    moves++;
                    flipIfNeeded();
                    score += 5;
                } else {
                    if (selected.type === 'waste') waste.push(moving);
                    else if (selected.type === 'foundation') foundations[selected.pile].push(moving);
                    else if (selected.type === 'tableau') tableau[selected.pile].push(moving);
                }
                selected = null;
                render();
            });
        });

        newBtn.addEventListener('click', resetGame);
        resetBtn.addEventListener('click', resetGame);
        undoBtn?.addEventListener('click', () => {
            if (popUndo()) render();
        });
        autoBtn?.addEventListener('click', () => {
            autoComplete();
        });
        drawToggleBtn?.addEventListener('click', () => {
            drawCount = drawCount === 1 ? 3 : 1;
            render();
        });

        function autoComplete() {
            let moved = false;
            let safety = 0;
            do {
                moved = false;
                safety++;
                // Try tableau top cards
                for (let t = 0; t < 7; t++) {
                    const pile = tableau[t];
                    if (pile.length === 0) continue;
                    const top = pile[pile.length -1];
                    if (!top.faceUp) continue;
                    if (autoMoveToFoundation(top, {type:'tableau', pile: t, cardIndex: pile.length -1})) {
                        moved = true; break;
                    }
                }
                if (moved) continue;
                // Try waste top
                if (waste.length) {
                    const topW = waste[waste.length -1];
                    if (autoMoveToFoundation(topW, {type:'waste'})) {
                        moved = true;
                    }
                }
            } while (moved && safety < 300);
            if (checkWin()) {
                statusEl.textContent = 'You win!';
                stopTimer();
            }
        }

        function checkWin() {
            return foundations.every(p => p.length === 13);
        }

        function invalidFeedback(el) {
            if (!el) return;
            el.classList.add('shake');
            setTimeout(() => el.classList.remove('shake'), 250);
        }

        // Wrap placeOnTarget with feedback and win check
        const origPlaceOnTarget = placeOnTarget;
        placeOnTarget = function(item, target) {
            const ok = origPlaceOnTarget(item, target);
            if (!ok) {
                const targetEl = target.type === 'foundation'
                    ? foundationsEl.querySelectorAll('.foundation')[target.pile]
                    : tableauEl.querySelectorAll('.tableau-pile')[target.pile];
                invalidFeedback(targetEl);
                score -= 1;
            } else {
                if (checkWin()) {
                    statusEl.textContent = 'You win!';
                    stopTimer();
                }
            }
            return ok;
        };
    }
    openSkiFree() {
        const skifreeApp = document.getElementById('skifree-app');
        if (!skifreeApp) return;

        if (skifreeApp.style.display === 'none' || !skifreeApp.style.display) {
            skifreeApp.style.display = 'flex';
            skifreeApp.style.left = `${80 + Math.random() * 80}px`;
            skifreeApp.style.top = `${40 + Math.random() * 40}px`;
            skifreeApp.style.width = '420px';
            skifreeApp.style.height = '430px';
            this.setupWindowDrag(skifreeApp);
            this.setupSingleWindowControls(skifreeApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('skifree-app');
            
            // Initialize game if not already initialized
            if (!skifreeApp.dataset.initialized) {
                this.initSkiFree();
                skifreeApp.dataset.initialized = 'true';
            }
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(skifreeApp);
    }

    openDoom() {
        const doomApp = document.getElementById('doom-app');
        if (!doomApp) return;

        if (doomApp.style.display === 'none' || !doomApp.style.display) {
            doomApp.style.display = 'flex';
            doomApp.style.left = `${70 + Math.random() * 80}px`;
            doomApp.style.top = `${50 + Math.random() * 50}px`;
            doomApp.style.width = '520px';
            doomApp.style.height = '420px';
            this.setupWindowDrag(doomApp);
            this.setupSingleWindowControls(doomApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('doom-app');
            
            // Initialize game if not already initialized
            if (!doomApp.dataset.initialized) {
                this.initDoom();
                doomApp.dataset.initialized = 'true';
            }
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(doomApp);
    }

    initSkiFree() {
        const canvas = document.getElementById('skifree-canvas');
        const ctx = canvas.getContext('2d');
        const distanceEl = document.getElementById('skifree-distance');
        const speedEl = document.getElementById('skifree-speed');
        const restartBtn = document.getElementById('skifree-restart');
        
        // Set fixed canvas dimensions (matches HTML attributes)
        canvas.width = 400;
        canvas.height = 350;
        
        // V-line parameters for perspective (MUST be defined before use)
        const V_LINE_PARAMS = {
            vanishingPointY: 20,
            vanishingPointX: 200,
            bottomY: 350,
            bottomLeftX: -120,
            bottomRightX: 520
        };
        
        // Track player Y for scaling (updated each frame)
        let playerYForScale = 150;

        // Get scale factor based on Y position (distance)
        // Gentle scaling: 0.75 (far) to 1.0 (close), and shrink more above player
        function getDistanceScale(y) {
            const { vanishingPointY, bottomY } = V_LINE_PARAMS;
            const clampedY = Math.max(vanishingPointY, Math.min(bottomY, y));
            const tBelow = (clampedY - vanishingPointY) / (bottomY - vanishingPointY);
            let base = 0.75 + Math.max(0, Math.min(1, tBelow)) * 0.25; // 75% to 100%

            // If object is above player, shrink further
            const playerRefY = Math.max(vanishingPointY + 1, Math.min(bottomY, playerYForScale));
            if (clampedY < playerRefY) {
                const tAbove = (playerRefY - clampedY) / (playerRefY - vanishingPointY);
                const shrink = 0.8 - 0.3 * Math.max(0, Math.min(1, tAbove)); // 0.8 down to 0.5
                base *= shrink;
            }

            return Math.max(0.5, Math.min(1.0, base));
        }
        
        // Get X bounds at a given Y position (within V-line)
        function getXBoundsAtY(y) {
            const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
            const t = Math.max(0, (y - vanishingPointY) / (bottomY - vanishingPointY));
            const leftBound = vanishingPointX + (bottomLeftX - vanishingPointX) * t;
            const rightBound = vanishingPointX + (bottomRightX - vanishingPointX) * t;
            return { left: leftBound, right: rightBound };
        }
        
        // Load skier image
        const skierImg = new Image();
        skierImg.src = 'assets/skier.png';
        let skierImageLoaded = false;
        skierImg.onload = () => {
            skierImageLoaded = true;
        };
        
        // Game state
        let gameRunning = false;
        let gameOver = false;
        let distance = 0;
        let speed = 2;       // slower base speed
        let maxSpeed = 6;    // lower top speed
        let turboSpeed = 9;  // lower turbo speed
        let isTurbo = false;
        let isJumping = false;
        let jumpHeight = 0;
        let jumpVelocity = 0;
        
        // Animation state
        let isAnimating = false;
        const startY = -30; // Start off-screen at top
        const targetY = 150; // Higher position for more vertical play space
        const animationSpeed = 3; // Pixels per frame (faster intro)
        
        // Player state
        const player = {
            x: 200, // Center of 400px canvas
            y: startY, // Start at top for animation
            width: 16,
            height: 20,
            direction: 0, // -1 left, 0 straight, 1 right
            angle: 0
        };
        
        // Obstacles
        let obstacles = [];
        const obstacleTypes = ['tree', 'rock', 'ramp', 'snowman'];
        
        // Yeti
        let yeti = null;
        let yetiAppeared = false;
        const yetiDistance = 2000; // When yeti appears
        
        // Input
        const keys = { left: false, right: false, down: false, fast: false, space: false };
        
        // Generate initial obstacles
        function generateObstacle() {
            const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
            const y = canvas.height + Math.random() * 100;
            
            // Spawn within V-line bounds at this Y position
            const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
            const t = Math.max(0, (y - vanishingPointY) / (bottomY - vanishingPointY));
            const leftBound = vanishingPointX + (bottomLeftX - vanishingPointX) * t;
            const rightBound = vanishingPointX + (bottomRightX - vanishingPointX) * t;
            
            // Random X within V-line bounds (with small margin)
            const margin = 10;
            const x = (leftBound + margin) + Math.random() * Math.max(10, (rightBound - leftBound - margin * 2));
            
            // Base dimensions (will be scaled when drawing)
            const baseWidth = type === 'tree' ? 20 : type === 'rock' ? 24 : type === 'ramp' ? 30 : 18;
            const baseHeight = type === 'tree' ? 30 : type === 'rock' ? 16 : type === 'ramp' ? 12 : 24;
            
            return {
                x: x,
                y: y,
                type: type,
                width: baseWidth,
                height: baseHeight,
                scale: getDistanceScale(y),
                passed: false
            };
        }
        
        // Initialize obstacles
        function initObstacles() {
            obstacles = [];
            for (let i = 0; i < 8; i++) {
                // Start obstacles below the player (player is at Y=200)
                const y = 220 + i * 50 + Math.random() * 30;
                
                // Calculate X within V-line bounds at this Y
                const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
                const t = Math.max(0, (y - vanishingPointY) / (bottomY - vanishingPointY));
                const leftBound = vanishingPointX + (bottomLeftX - vanishingPointX) * t;
                const rightBound = vanishingPointX + (bottomRightX - vanishingPointX) * t;
                const margin = 10;
                const x = (leftBound + margin) + Math.random() * Math.max(10, (rightBound - leftBound - margin * 2));
                
                const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
                const baseWidth = type === 'tree' ? 20 : type === 'rock' ? 24 : type === 'ramp' ? 30 : 18;
                const baseHeight = type === 'tree' ? 30 : type === 'rock' ? 16 : type === 'ramp' ? 12 : 24;
                
                obstacles.push({
                    x: x,
                    y: y,
                    type: type,
                    width: baseWidth,
                    height: baseHeight,
                    scale: getDistanceScale(y),
                    passed: false
                });
            }
        }
        
        // Draw skier
        function drawSkier() {
            ctx.save();
            ctx.translate(player.x, player.y - jumpHeight);
            
            // Shadow when jumping
            if (isJumping) {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(0, jumpHeight + 10, 8, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw skier image
            if (skierImageLoaded) {
                const dir = player.direction;
                // Scale down the image - make it slightly smaller
                const scale = 0.045; // 4.5% of original size
                const imgWidth = (skierImg.width || 32) * scale;
                const imgHeight = (skierImg.height || 32) * scale;
                
                // Flip horizontally if going left (original faces right)
                if (dir < 0) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(skierImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                } else {
                    ctx.drawImage(skierImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                }
            } else {
                // Fallback drawing if image not loaded yet
                const dir = player.direction;
                ctx.fillStyle = '#0000AA';
                ctx.fillRect(-4, -8, 8, 12);
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(-3, -14, 6, 6);
            }
            
            ctx.restore();
        }
        
        // Draw tree
        function drawTree(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            // Trunk
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-3, 10, 6, 10);
            
            // Foliage (triangles)
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(-12, 5);
            ctx.lineTo(12, 5);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(-10, 12);
            ctx.lineTo(10, 12);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw rock
        function drawRock(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = '#696969';
            ctx.beginPath();
            ctx.ellipse(0, 4, 12, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.ellipse(-2, 2, 8, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw ramp
        function drawRamp(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = '#DEB887';
            ctx.beginPath();
            ctx.moveTo(-15, 6);
            ctx.lineTo(15, 6);
            ctx.lineTo(10, -4);
            ctx.lineTo(-10, -4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw snowman
        function drawSnowman(x, y, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#CCCCCC';
            ctx.lineWidth = 1;
            // Bottom
            ctx.beginPath();
            ctx.arc(0, 8, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Middle
            ctx.beginPath();
            ctx.arc(0, -2, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Head
            ctx.beginPath();
            ctx.arc(0, -10, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(-2, -11, 2, 2);
            ctx.fillRect(1, -11, 2, 2);
            // Carrot nose
            ctx.fillStyle = '#FFA500';
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(5, -8);
            ctx.lineTo(0, -7);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw yeti
        function drawYeti(x, y) {
            // Body
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x - 15, y - 20, 30, 35);
            
            // Head
            ctx.fillRect(x - 10, y - 32, 20, 14);
            
            // Eyes (angry)
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(x - 6, y - 28, 4, 4);
            ctx.fillRect(x + 2, y - 28, 4, 4);
            
            // Mouth
            ctx.fillStyle = '#000';
            ctx.fillRect(x - 5, y - 22, 10, 3);
            
            // Arms
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x - 25, y - 15, 12, 8);
            ctx.fillRect(x + 13, y - 15, 12, 8);
            
            // Legs
            ctx.fillRect(x - 12, y + 15, 10, 10);
            ctx.fillRect(x + 2, y + 15, 10, 10);
            
            // Claws
            ctx.fillStyle = '#333';
            ctx.fillRect(x - 26, y - 14, 3, 6);
            ctx.fillRect(x + 23, y - 14, 3, 6);
        }
        
        // Draw obstacle
        function drawObstacle(obs) {
            switch(obs.type) {
                case 'tree': drawTree(obs.x, obs.y, obs.scale); break;
                case 'rock': drawRock(obs.x, obs.y, obs.scale); break;
                case 'ramp': drawRamp(obs.x, obs.y, obs.scale); break;
                case 'snowman': drawSnowman(obs.x, obs.y, obs.scale); break;
            }
        }
        
        // Check collision
        function checkCollision(obs) {
            if (isJumping && jumpHeight > 15) return false;
            
            const px = player.x;
            const py = player.y;
            const pw = player.width / 2;
            const ph = player.height / 2;
            
            const ox = obs.x;
            const oy = obs.y;
            // Use scaled dimensions for collision (scale is updated in drawObstacle)
            const scale = obs.scale || 1;
            const ow = (obs.width * scale) / 2;
            const oh = (obs.height * scale) / 2;
            
            return px - pw < ox + ow &&
                   px + pw > ox - ow &&
                   py - ph < oy + oh &&
                   py + ph > oy - oh;
        }
        
        // Draw crashed skier
        function drawCrashedSkier() {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(Math.PI / 2);
            
            // Body
            ctx.fillStyle = '#0000AA';
            ctx.fillRect(-6, -4, 12, 8);
            
            // Head
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-12, -3, 6, 6);
            
            // Skis scattered
            ctx.fillStyle = '#8B4513';
            ctx.save();
            ctx.rotate(0.5);
            ctx.fillRect(8, -8, 4, 12);
            ctx.restore();
            ctx.save();
            ctx.rotate(-0.3);
            ctx.fillRect(10, 4, 4, 12);
            ctx.restore();
            
            ctx.restore();
        }
        
        // Draw eaten skier (by yeti)
        function drawEatenSkier() {
            ctx.fillStyle = '#FF0000';
            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀', player.x, player.y);
        }
        
        // Draw perspective V-line guide (for debugging - can be toggled)
        const showPerspectiveGuide = true; // Set to true to show guide lines
        
        function drawPerspectiveGuide() {
            if (!showPerspectiveGuide) return;
            
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            const { vanishingPointY, vanishingPointX, bottomLeftX, bottomRightX, bottomY } = V_LINE_PARAMS;
            
            // Draw left line of V
            ctx.moveTo(vanishingPointX, vanishingPointY);
            ctx.lineTo(bottomLeftX, bottomY);
            
            // Draw right line of V
            ctx.moveTo(vanishingPointX, vanishingPointY);
            ctx.lineTo(bottomRightX, bottomY);
            
            ctx.stroke();
        }
        
        // Game loop
        function gameLoop() {
            if (!gameRunning) return;
            
            // Clear canvas (keep background visible through canvas)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw perspective guide V-line
            drawPerspectiveGuide();
            
            // Draw snow texture (dots)
            ctx.fillStyle = '#E8E8E8';
            for (let i = 0; i < 50; i++) {
                const sx = (i * 37 + distance * 0.5) % canvas.width;
                const sy = (i * 23 + distance) % canvas.height;
                ctx.fillRect(sx, sy, 2, 2);
            }
            
            // Handle intro animation
            if (isAnimating) {
                player.y += animationSpeed;
                if (player.y >= targetY) {
                    player.y = targetY;
                    isAnimating = false;
                }
                // Draw skier during animation
                drawSkier();
                requestAnimationFrame(gameLoop);
                return;
            }
            
            if (!gameOver) {
                // Update speed
                const currentMaxSpeed = isTurbo ? turboSpeed : maxSpeed;
                if (keys.down) {
                    speed = Math.min(speed + 0.06, currentMaxSpeed);
                } else if (isTurbo) {
                    speed = Math.min(speed + 0.04, turboSpeed);
                } else {
                    speed = Math.max(2, speed - 0.03);
                }
                
                // Update direction
                if (keys.left) {
                    player.direction = Math.max(-1, player.direction - 0.1);
                } else if (keys.right) {
                    player.direction = Math.min(1, player.direction + 0.1);
                } else {
                    player.direction *= 0.95;
                }
                
                // Move player horizontally (constrained to V-line bounds at player's Y)
                player.x += player.direction * speed * 0.8;
                const bounds = getXBoundsAtY(player.y);
                player.x = Math.max(bounds.left + 15, Math.min(bounds.right - 15, player.x));
                // Track player Y for scaling calculations
                playerYForScale = player.y;
                
                // Update jump
                if (isJumping) {
                    jumpHeight += jumpVelocity;
                    jumpVelocity -= 0.8;
                    if (jumpHeight <= 0) {
                        jumpHeight = 0;
                        isJumping = false;
                    }
                }
                
                // Update distance
                distance += speed * 0.5;
                distanceEl.textContent = Math.floor(distance);
                speedEl.textContent = Math.floor(speed * 10);
                
                // Move obstacles (straight down, no horizontal movement)
                for (let obs of obstacles) {
                    obs.y -= speed;
                    
                    // Keep X within V-line bounds at this Y (clamp only, no sliding)
                    const bounds = getXBoundsAtY(obs.y);
                    const margin = 10;
                    const left = bounds.left + margin;
                    const right = bounds.right - margin;
                    if (left < right) {
                        obs.x = Math.max(left, Math.min(right, obs.x));
                    }
                    
                    // Update scale based on Y position (bigger when closer/lower)
                    obs.scale = getDistanceScale(obs.y);
                    
                    // Check for ramp jump
                    if (obs.type === 'ramp' && !isJumping) {
                        if (checkCollision(obs)) {
                            isJumping = true;
                            jumpVelocity = 8;
                            jumpHeight = 1;
                        }
                    }
                    
                    // Check collision
                    if (obs.type !== 'ramp' && checkCollision(obs)) {
                        gameOver = true;
                    }
                }
                
                // Remove passed obstacles before they reach the top (vanishing point)
                obstacles = obstacles.filter(obs => obs.y > V_LINE_PARAMS.vanishingPointY + 40);
                while (obstacles.length < 8) {
                    obstacles.push(generateObstacle());
                }
                
                // Spawn yeti
                if (!yetiAppeared && distance > yetiDistance) {
                    yetiAppeared = true;
                    yeti = {
                        x: player.x,
                        y: canvas.height + 50,
                        speed: speed + 1
                    };
                }
                
                // Update yeti
                if (yeti) {
                    // Yeti chases player
                    const dx = player.x - yeti.x;
                    yeti.x += dx * 0.02;
                    yeti.y -= yeti.speed - speed + 2;
                    
                    // Speed up yeti over time
                    yeti.speed = Math.min(yeti.speed + 0.001, 15);
                    
                    // Check if yeti caught player
                    if (yeti.y < player.y + 30 && Math.abs(yeti.x - player.x) < 25) {
                        gameOver = true;
                    }
                }
            }
            
            // Draw obstacles (sorted by y for proper layering)
            obstacles.sort((a, b) => a.y - b.y);
            for (let obs of obstacles) {
                if (obs.y > V_LINE_PARAMS.vanishingPointY + 40 && obs.y < canvas.height + 30) {
                    drawObstacle(obs);
                }
            }
            
            // Draw yeti
            if (yeti && yeti.y > -50 && yeti.y < canvas.height + 50) {
                drawYeti(yeti.x, yeti.y);
            }
            
            // Draw player
            if (gameOver) {
                if (yeti && yeti.y < player.y + 50) {
                    drawEatenSkier();
                } else {
                    drawCrashedSkier();
                }
                
                // Game over text
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(canvas.width/2 - 80, canvas.height/2 - 30, 160, 60);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 16px "W95FA", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 5);
                ctx.font = '12px "W95FA", monospace';
                ctx.fillText(`Distance: ${Math.floor(distance)}m`, canvas.width/2, canvas.height/2 + 15);
            } else {
                drawSkier();
            }
            
            requestAnimationFrame(gameLoop);
        }
        
        // Reset game
        function resetGame() {
            distance = 0;
            speed = 3;
            isTurbo = false;
            isJumping = false;
            jumpHeight = 0;
            jumpVelocity = 0;
            player.x = 200; // Center of 400px canvas
            player.y = startY; // Reset to top for animation
            player.direction = 0;
            gameOver = false;
            yetiAppeared = false;
            yeti = null;
            isAnimating = true; // Start intro animation
            initObstacles();
            distanceEl.textContent = '0';
            speedEl.textContent = '0';
            
            if (!gameRunning) {
                gameRunning = true;
                gameLoop();
            }
        }
        
        // Event listeners
        document.addEventListener('keydown', (e) => {
            // Only handle if skifree window is focused
            const skifreeApp = document.getElementById('skifree-app');
            if (!skifreeApp || skifreeApp.style.display === 'none') return;
            if (!skifreeApp.classList.contains('active')) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    keys.left = true;
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    keys.right = true;
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    keys.down = true;
                    e.preventDefault();
                    break;
                case 'f':
                case 'F':
                    isTurbo = true;
                    e.preventDefault();
                    break;
                case ' ':
                    if (!isJumping && !gameOver) {
                        isJumping = true;
                        jumpVelocity = 6;
                        jumpHeight = 1;
                    }
                    e.preventDefault();
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.key) {
                case 'ArrowLeft': keys.left = false; break;
                case 'ArrowRight': keys.right = false; break;
                case 'ArrowDown': keys.down = false; break;
                case 'f':
                case 'F': isTurbo = false; break;
            }
        });
        
        restartBtn.addEventListener('click', resetGame);
        
        // Start game
        resetGame();
    }

    setupSystemMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        
        // Setup menu item actions
        dropdown.querySelectorAll('.system-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                if (item.classList.contains('disabled')) return;
                
                if (action && this.currentWindow) {
                    const isProgramManager = this.currentWindow.classList.contains('program-manager');
                    
                    switch (action) {
                        case 'minimize':
                            if (isProgramManager) {
                                this.minimizeProgramManager();
                            } else {
                                this.minimizeWindow(this.currentWindow);
                            }
                            break;
                        case 'maximize':
                            if (!isProgramManager) {
                                this.toggleMaximize(this.currentWindow);
                            }
                            break;
                        case 'close':
                            if (isProgramManager) {
                                this.minimizeProgramManager();
                            } else {
                                this.currentWindow.style.display = 'none';
                            }
                            break;
                    }
                }
                this.hideSystemMenu();
            });
        });
    }

    setupClickOutside() {
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('system-menu-dropdown');
            if (!e.target.classList.contains('system-menu') && 
                !dropdown.contains(e.target)) {
                this.hideSystemMenu();
            }
        });
    }

    showSystemMenu(win, systemMenuBtn) {
        const dropdown = document.getElementById('system-menu-dropdown');
        this.currentWindow = win;
        
        // Position the dropdown below the system menu button
        const rect = systemMenuBtn.getBoundingClientRect();
        const screenContent = document.querySelector('.screen-content');
        const screenRect = screenContent.getBoundingClientRect();
        
        dropdown.style.left = (rect.left - screenRect.left) + 'px';
        dropdown.style.top = (rect.bottom - screenRect.top) + 'px';
        dropdown.style.display = 'block';
        
        // Update Restore state (disabled if not maximized)
        const restoreItem = dropdown.querySelector('.system-menu-item:first-child');
        if (win.classList.contains('maximized')) {
            restoreItem.classList.remove('disabled');
        } else {
            restoreItem.classList.add('disabled');
        }
    }

    hideSystemMenu() {
        const dropdown = document.getElementById('system-menu-dropdown');
        dropdown.style.display = 'none';
        this.currentWindow = null;
    }

    showDesktopIconMenu(icon, appId) {
        const menu = document.getElementById('desktop-icon-menu');
        if (!menu) return;
        
        // Position menu below the icon
        const rect = icon.getBoundingClientRect();
        const screenContent = document.querySelector('.screen-content');
        const screenRect = screenContent.getBoundingClientRect();
        
        menu.style.left = (rect.left - screenRect.left) + 'px';
        menu.style.top = (rect.bottom - screenRect.top + 2) + 'px';
        menu.style.display = 'block';
        menu.dataset.appId = appId;
        
        // Update menu items based on app state
        const restoreItem = menu.querySelector('[data-action="restore"]');
        const minimizeItem = menu.querySelector('[data-action="minimize"]');
        const maximizeItem = menu.querySelector('[data-action="maximize"]');
        
        if (appId === 'program-manager') {
            const programManager = document.querySelector('.program-manager');
            if (programManager && programManager.style.display === 'none') {
                // Program Manager is minimized - enable Restore, disable Minimize
                restoreItem.classList.remove('disabled');
                if (minimizeItem) minimizeItem.classList.add('disabled');
            } else {
                // Program Manager is open - disable Restore, enable Minimize
                restoreItem.classList.add('disabled');
                if (minimizeItem) minimizeItem.classList.remove('disabled');
            }
            // Maximize is always disabled for Program Manager (it's always maximized)
            if (maximizeItem) maximizeItem.classList.add('disabled');
        } else if (appId === 'ai-assistant') {
            const aiWindow = document.getElementById('ai-assistant-app');
            if (aiWindow && aiWindow.style.display === 'none') {
                // AI Assistant is closed - disable Restore and Minimize
                restoreItem.classList.add('disabled');
                if (minimizeItem) minimizeItem.classList.add('disabled');
            } else {
                // AI Assistant is open - enable Restore and Minimize
                restoreItem.classList.remove('disabled');
                if (minimizeItem) minimizeItem.classList.remove('disabled');
            }
            // Maximize is always disabled for desktop icons (they're not windows)
            if (maximizeItem) maximizeItem.classList.add('disabled');
        }
        
        // Setup menu item handlers
        this.setupDesktopIconMenuHandlers(menu, appId);
    }

    hideDesktopIconMenu() {
        const menu = document.getElementById('desktop-icon-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    showTaskbarItemMenu(taskbarItem, windowId, window, title) {
        const menu = document.getElementById('taskbar-item-menu');
        if (!menu) return;
        
        // Position menu below or above the taskbar item based on position
        const rect = taskbarItem.getBoundingClientRect();
        const screenContent = document.querySelector('.screen-content');
        const screenRect = screenContent.getBoundingClientRect();
        
        menu.style.left = (rect.left - screenRect.left) + 'px';
        
        // Check if there's enough space below - if not, show menu above
        const spaceBelow = screenRect.bottom - rect.bottom;
        const spaceAbove = rect.top - screenRect.top;
        const menuHeight = 200; // Approximate menu height
        
        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
            // Not enough space below, but enough above - show menu above
            menu.style.top = (rect.top - screenRect.top - menuHeight - 2) + 'px';
        } else {
            // Enough space below - show menu below
            menu.style.top = (rect.bottom - screenRect.top + 2) + 'px';
        }
        
        menu.style.display = 'block';
        menu.dataset.windowId = windowId;
        
        // Update menu items based on window state
        const restoreItem = menu.querySelector('[data-action="restore"]');
        const moveItem = menu.querySelector('[data-action="move"]');
        const minimizeItem = menu.querySelector('[data-action="minimize"]');
        const maximizeItem = menu.querySelector('[data-action="maximize"]');
        
        // Window is minimized, so Restore and Move should be enabled
        if (restoreItem) restoreItem.classList.remove('disabled');
        if (moveItem) moveItem.classList.remove('disabled');
        if (minimizeItem) minimizeItem.classList.add('disabled');
        if (maximizeItem) maximizeItem.classList.add('disabled');
        
        // Setup menu item handlers
        this.setupTaskbarItemMenuHandlers(menu, windowId, window);
    }

    hideTaskbarItemMenu() {
        const menu = document.getElementById('taskbar-item-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    setupTaskbarItemMenuHandlers(menu, windowId, window) {
        // Remove existing handlers to avoid duplicates
        const items = menu.querySelectorAll('.system-menu-item');
        items.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Restore
        const restoreItem = menu.querySelector('[data-action="restore"]');
        if (restoreItem && !restoreItem.classList.contains('disabled')) {
            restoreItem.addEventListener('click', () => {
                this.hideTaskbarItemMenu();
                this.restoreFromTaskbar(windowId, window);
            });
        }
        
        // Move - disabled for taskbar items (windows are moved by dragging titlebar)
        
        // Close
        const closeItem = menu.querySelector('[data-action="close"]');
        if (closeItem) {
            closeItem.addEventListener('click', () => {
                this.hideTaskbarItemMenu();
                if (window) {
                    window.style.display = 'none';
                    this.removeFromTaskbar(windowId);
                }
            });
        }
        
        // Switch To
        const switchItem = menu.querySelector('[data-action="switch-to"]');
        if (switchItem) {
            switchItem.addEventListener('click', () => {
                this.hideTaskbarItemMenu();
                this.restoreFromTaskbar(windowId, window);
                if (window) {
                    this.focusWindow(window);
                }
            });
        }
    }

    setupDesktopIconMenuHandlers(menu, appId) {
        // Remove existing handlers to avoid duplicates
        const items = menu.querySelectorAll('.system-menu-item');
        items.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Restore
        const restoreItem = menu.querySelector('[data-action="restore"]');
        if (restoreItem && !restoreItem.classList.contains('disabled')) {
            restoreItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                if (appId === 'program-manager') {
                    this.restoreProgramManager();
                } else if (appId === 'ai-assistant') {
                    const aiWindow = document.getElementById('ai-assistant-app');
                    if (aiWindow && aiWindow.style.display === 'none') {
                        this.openAIAssistant();
                    }
                }
            });
        }
        
        // Move - enable move mode for desktop icons
        const moveItem = menu.querySelector('[data-action="move"]');
        if (moveItem) {
            moveItem.classList.remove('disabled');
            moveItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                
                // Find the icon element
                let icon;
                if (appId === 'program-manager') {
                    icon = document.querySelector('.minimized-program-manager');
                } else if (appId === 'ai-assistant') {
                    icon = document.querySelector('.desktop-icon[data-app="ai-assistant"]');
                }
                
                if (icon) {
                    // Enable move mode - icon follows cursor
                    icon.dataset.moveMode = 'true';
                    document.body.classList.add('move-mode-active');
                    
                    const moveHandler = (e) => {
                        if (icon.dataset.moveMode !== 'true') {
                            document.removeEventListener('mousemove', moveHandler);
                            return;
                        }
                        
                        const screenContent = document.querySelector('.screen-content');
                        const screenRect = screenContent.getBoundingClientRect();
                        
                        // Center icon on cursor
                        const iconWidth = icon.offsetWidth;
                        const iconHeight = icon.offsetHeight;
                        
                        let newLeft = e.clientX - screenRect.left - iconWidth / 2;
                        let newTop = e.clientY - screenRect.top - iconHeight / 2;
                        
                        // Constrain to screen bounds
                        newLeft = Math.max(0, Math.min(newLeft, screenContent.offsetWidth - iconWidth));
                        newTop = Math.max(0, Math.min(newTop, screenContent.offsetHeight - iconHeight));
                        
                        icon.style.position = 'absolute';
                        icon.style.left = newLeft + 'px';
                        icon.style.top = newTop + 'px';
                    };
                    
                    const placeHandler = (e) => {
                        if (icon.dataset.moveMode === 'true') {
                            delete icon.dataset.moveMode;
                            document.body.classList.remove('move-mode-active');
                            document.removeEventListener('mousemove', moveHandler);
                            document.removeEventListener('click', placeHandler);
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    };
                    
                    document.addEventListener('mousemove', moveHandler);
                    // Use setTimeout to avoid immediate click placement
                    setTimeout(() => {
                        document.addEventListener('click', placeHandler);
                    }, 100);
                }
            });
        }
        
        // Close
        const closeItem = menu.querySelector('[data-action="close"]');
        if (closeItem) {
            closeItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                if (appId === 'program-manager') {
                    // Can't close Program Manager, just minimize
                    this.minimizeProgramManager();
                } else if (appId === 'ai-assistant') {
                    const aiWindow = document.getElementById('ai-assistant-app');
                    if (aiWindow) {
                        aiWindow.style.display = 'none';
                        this.removeFromTaskbar('ai-assistant-app');
                    }
                }
            });
        }
        
        // Switch To
        const switchItem = menu.querySelector('[data-action="switch-to"]');
        if (switchItem) {
            switchItem.addEventListener('click', () => {
                this.hideDesktopIconMenu();
                if (appId === 'program-manager') {
                    this.restoreProgramManager();
                    const programManager = document.querySelector('.program-manager');
                    if (programManager) {
                        this.focusWindow(programManager);
                    }
                } else if (appId === 'ai-assistant') {
                    const aiWindow = document.getElementById('ai-assistant-app');
                    if (aiWindow) {
                        if (aiWindow.style.display === 'none') {
                            this.openAIAssistant();
                        }
                        this.focusWindow(aiWindow);
                    }
                }
            });
        }
    }

    toggleMaximize(win) {
        if (win.classList.contains('maximized')) {
            win.classList.remove('maximized');
            win.style.width = '';
            win.style.height = '';
            win.style.left = '';
            win.style.top = '';
        } else {
            win.classList.add('maximized');
            win.style.width = '100%';
            win.style.height = 'calc(100% - 44px)';
            win.style.left = '0';
            win.style.top = '44px';
        }
    }

    openProgramGroup(groupId) {
        const windowId = `${groupId}-window`;
        const win = document.getElementById(windowId);
        
        if (win) {
            if (win.style.display === 'none' || !win.style.display) {
                win.style.display = 'flex';
                win.style.zIndex = ++this.zIndex;
                this.setupWindowDrag(win);
                this.setupSingleWindowControls(win);
                // Remove from taskbar if it was there
                this.removeFromTaskbar(windowId);
            }
            this.focusWindow(win);
        }
    }

    setupSingleWindowControls(win) {
        if (win.dataset.controlsSetup) return;
        win.dataset.controlsSetup = 'true';

        // Focus window when clicking on window content
        const windowContent = win.querySelector('.window-content');
        if (windowContent) {
            windowContent.addEventListener('mousedown', () => {
                this.focusWindow(win);
            });
        }

        const systemMenuBtn = win.querySelector('.system-menu');
        const buttons = win.querySelectorAll('.window-btn');
        const minimizeBtn = buttons[0];
        const maximizeBtn = buttons[1];

        // System menu button - show dropdown
        if (systemMenuBtn) {
            systemMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.focusWindow(win); // Bring to front first
                const dropdown = document.getElementById('system-menu-dropdown');
                if (dropdown.style.display === 'block' && this.currentWindow === win) {
                    this.hideSystemMenu();
                } else {
                    this.showSystemMenu(win, systemMenuBtn);
                }
            });
        }

        // Minimize button
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimizeWindow(win);
            });
        }

        // Maximize button
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMaximize(win);
            });
        }

        // Click anywhere on window to bring to front
        win.addEventListener('mousedown', (e) => {
            // Don't focus if clicking on controls
            if (!e.target.classList.contains('window-btn') && 
                !e.target.classList.contains('system-menu') &&
                !e.target.closest('.window-btn') &&
                !e.target.closest('.system-menu')) {
                this.focusWindow(win);
            }
        });
    }

    setupWindowDrag(win) {
        const titlebar = win.querySelector('.window-titlebar');
        if (!titlebar || titlebar.dataset.dragSetup) return;
        titlebar.dataset.dragSetup = 'true';

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        titlebar.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons or system menu
            if (e.target.classList.contains('window-btn') || 
                e.target.closest('.window-btn') ||
                e.target.classList.contains('system-menu') ||
                e.target.closest('.system-menu')) {
                return;
            }
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get current position relative to screen content
            const rect = win.getBoundingClientRect();
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            initialLeft = rect.left - screenRect.left;
            initialTop = rect.top - screenRect.top;
            
            this.focusWindow(win);
            e.preventDefault();
        });

        const mousemoveHandler = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const screenContent = document.querySelector('.screen-content');
            const screenRect = screenContent.getBoundingClientRect();
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // Constrain to screen bounds
            const maxX = screenContent.offsetWidth - win.offsetWidth;
            const maxY = screenContent.offsetHeight - win.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            win.style.left = newLeft + 'px';
            win.style.top = newTop + 'px';
            win.style.position = 'absolute';
        };

        document.addEventListener('mousemove', mousemoveHandler);

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    minimizeWindow(win) {
        win.style.display = 'none';
        const title = win.querySelector('.window-title').textContent;
        const windowId = win.id || `window-${Date.now()}`;
        if (!win.id) win.id = windowId;
        this.addToTaskbar(windowId, title, win);
    }

    focusWindow(win) {
        // Remove active from all windows
        document.querySelectorAll('.program-group-window, .application-window').forEach(w => {
            w.classList.remove('active');
        });
        
        // Bring this window to front
        win.classList.add('active');
        win.style.zIndex = ++this.zIndex;
        
        // Deselect desktop icons when focusing a window
        document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
        
        // Update taskbar active state
        this.minimizedWindows.forEach((entry, windowId) => {
            if (entry.window === win) {
                entry.taskbarItem.classList.add('active');
            } else {
                entry.taskbarItem.classList.remove('active');
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.programManager = new ProgramManager();
});
