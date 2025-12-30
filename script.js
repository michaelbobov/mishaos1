// Retro Program Manager

class ProgramManager {
    constructor() {
        this.zIndex = 100;
        this.mdiOffset = 0; // For cascading MDI child windows
        this.currentWindow = null;
        this.minimizedWindows = new Map();
        this.masterVolume = 0.5; // Master volume (0.0 to 1.0) - default 50%
        this.isMuted = false;
        this.audioElements = []; // Track all audio elements
        // API calls: use Vercel serverless function in production, direct API in local dev
        this.apiProxyUrl = '/api/openai'; // Vercel serverless function endpoint
        this.selectedYear = parseInt(localStorage.getItem('selectedYear') || '1992'); // Default to 1992
        this.isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // For local development, allow users to enter their own API key
        this.openaiApiKey = localStorage.getItem('openaiApiKey') || null;
        this.init();
    }

    getNextMdiPosition() {
        // First window should be flush with top-left (0, 0)
        // Subsequent windows cascade with offset
        if (this.mdiOffset === 0) {
            this.mdiOffset = (this.mdiOffset + 1) % 6;
            return { left: 0, top: 0 };
        }
        const offset = this.mdiOffset * 25;
        this.mdiOffset = (this.mdiOffset + 1) % 6; // Reset after 6 windows
        return { left: 0 + offset, top: 0 + offset };
    }

    getStandaloneWindowPosition() {
        // Position at top-left, flush with edge, below File menu
        // Title bar (20px) + Menu bar (padding + border) = ~42px from top
        // Windows are positioned relative to .retro-desktop
        return { left: 0, top: 42 };
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
        this.setupDesktopClock();
        this.setupStickyNoteSound();
        this.setupYearSelector();
        this.applyYearTheme(this.selectedYear);
        this.updateStatusBar();
        setInterval(() => this.updateStatusBar(), 1000);
        
        // Load startup programs after a short delay
        setTimeout(() => {
            this.loadStartupPrograms();
            // Always open Read Me on startup
            this.openReadme();
        }, 500);
    }

    // Update master volume for all audio elements
    updateMasterVolume(volumePercent, muted = false) {
        this.masterVolume = volumePercent / 100;
        this.isMuted = muted;
        
        // Update all tracked audio elements
        this.audioElements.forEach(audioInfo => {
            if (audioInfo.audio) {
                const baseVolume = audioInfo.baseVolume || 1.0;
                audioInfo.audio.volume = muted ? 0 : (baseVolume * this.masterVolume);
            }
        });
    }

    setupDesktopClock() {
        const clockWindow = document.getElementById('desktop-clock');
        if (clockWindow) {
            // Set up window controls (minimize, maximize)
            this.setupSingleWindowControls(clockWindow);
            // Set up window dragging
            this.setupWindowDrag(clockWindow);
        }
        
        const updateClock = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            
            const hourHand = document.getElementById('clock-hand-hour');
            const minuteHand = document.getElementById('clock-hand-minute');
            const secondHand = document.getElementById('clock-hand-second');
            
            if (hourHand && minuteHand && secondHand) {
                // Calculate rotation angles
                const hourDeg = (hours % 12) * 30 + minutes * 0.5; // 30 degrees per hour + 0.5 per minute
                const minuteDeg = minutes * 6 + seconds * 0.1; // 6 degrees per minute
                const secondDeg = seconds * 6; // 6 degrees per second
                
                hourHand.style.transform = `rotate(${hourDeg}deg)`;
                minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
                secondHand.style.transform = `rotate(${secondDeg}deg)`;
            }
        };
        
        // Update immediately and then every second
        updateClock();
        setInterval(updateClock, 1000);
    }

    setupStickyNoteSound() {
        const stickyNoteWrapper = document.querySelector('.sticky-note-wrapper');
        if (!stickyNoteWrapper) return;

        const pageTurnSound = new Audio('sounds/Book Page Turn Flip Sound Effect.mp3');
        const baseVolume = 0.6;
        pageTurnSound.preload = 'auto';
        // Handle potential CORS or loading errors
        pageTurnSound.addEventListener('error', (e) => {
            console.warn('Failed to load page turn sound:', e);
        });
        pageTurnSound.load();
        
        // Register with volume system
        this.audioElements.push({
            audio: pageTurnSound,
            baseVolume: baseVolume
        });
        // Apply current master volume
        pageTurnSound.volume = this.isMuted ? 0 : (baseVolume * this.masterVolume);
        
        let soundDuration = 0;
        let isPlaying = false;

        pageTurnSound.addEventListener('loadedmetadata', () => {
            soundDuration = pageTurnSound.duration;
        });

        // Use the smaller clickable area instead of the whole wrapper
        const clickableArea = stickyNoteWrapper.querySelector('.sticky-note-clickable-area');
        const targetElement = clickableArea || stickyNoteWrapper;
        
        targetElement.addEventListener('mouseenter', () => {
            if (isPlaying || soundDuration === 0) return;
            
            const middleStart = Math.max(0, (soundDuration / 2) - 0.1);
            const playDuration = 0.2;
            
            pageTurnSound.currentTime = middleStart;
            isPlaying = true;
            
            pageTurnSound.play().then(() => {
                setTimeout(() => {
                    pageTurnSound.pause();
                    pageTurnSound.currentTime = 0;
                    isPlaying = false;
                }, playDuration * 1000);
            }).catch(() => {
                isPlaying = false;
            });
        });

        // Click on sticky note opens portfolio
        targetElement.addEventListener('click', () => {
            window.open('https://www.michaelbobov.com/', '_blank');
        });
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
        const insertSoundBaseVolume = 0.4;
        this.vhsPlayer.insertSound.preload = 'auto';
        // Handle potential CORS or loading errors
        this.vhsPlayer.insertSound.addEventListener('error', (e) => {
            console.warn('Failed to load VHS insert sound:', e);
        });
        
        // Register with volume system
        this.audioElements.push({
            audio: this.vhsPlayer.insertSound,
            baseVolume: insertSoundBaseVolume
        });
        // Apply current master volume
        this.vhsPlayer.insertSound.volume = this.isMuted ? 0 : (insertSoundBaseVolume * this.masterVolume);

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
            const targetMasterVolume = this.isMuted ? 0 : (1.0 * this.masterVolume);

            const fadeOutIntervalId = setInterval(() => {
                currentStep++;
                const targetVolume = startVolume * (1 - currentStep / fadeOutSteps);
                // Fade to zero, not to master volume (since we're stopping)
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
            // Remove old audio from tracking
            const oldIndex = this.audioElements.findIndex(el => el.audio === this.vhsPlayer.audio);
            if (oldIndex !== -1) {
                this.audioElements.splice(oldIndex, 1);
            }
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
        
        // Register with volume system (remove old one if exists)
        const existingIndex = this.audioElements.findIndex(el => el.audio === audio);
        if (existingIndex === -1) {
            this.audioElements.push({
                audio: audio,
                baseVolume: 1.0
            });
        }

        // Fade in functionality
        const targetMasterVolume = this.isMuted ? 0 : (1.0 * this.masterVolume);
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
                const currentTargetVolume = (currentStep / fadeInSteps) * targetMasterVolume;
                audio.volume = Math.min(currentTargetVolume, targetMasterVolume);
                
                if (currentStep >= fadeInSteps) {
                    clearInterval(fadeInIntervalId);
                    audio.volume = targetMasterVolume; // Ensure it's at master volume
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
                e.target.classList.contains('retro-desktop') ||
                e.target.classList.contains('screen-content')) {
                document.querySelectorAll('.desktop-icon, .minimized-program-manager').forEach(i => i.classList.remove('selected'));
            }
        });
    }

    setupStatusBarControls() {
        // Volume control
        const volumeControl = document.getElementById('volume-control');
        const volumeValue = document.getElementById('volume-value');
        let volume = 50; // Default 50%
        let isMuted = false;

        // Create volume dropdown
        const volumeDropdown = document.createElement('div');
        volumeDropdown.className = 'volume-dropdown';
        volumeDropdown.id = 'volume-dropdown';
        volumeDropdown.innerHTML = `
            <div class="volume-slider-container">
                <div class="volume-slider-label">Volume: <span id="volume-display">50%</span></div>
                <input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="50" />
                <button class="volume-mute-btn" id="volume-mute-btn">Mute</button>
            </div>
        `;
        document.querySelector('.screen-content').appendChild(volumeDropdown);

        const volumeSlider = document.getElementById('volume-slider');
        const volumeDisplay = document.getElementById('volume-display');
        const muteBtn = document.getElementById('volume-mute-btn');
        
        // Initialize volume display and icon
        volumeValue.textContent = '50%';
        volumeControl.querySelector('.status-icon').textContent = '🔉';
        
        // Initialize master volume to 50%
        this.updateMasterVolume(50, false);

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
                // Update all audio volumes
                this.updateMasterVolume(volume, false);
            }
        });

        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                volumeValue.textContent = 'Muted';
                volumeDisplay.textContent = 'Muted';
                volumeControl.querySelector('.status-icon').textContent = '🔇';
                muteBtn.textContent = 'Unmute';
                // Mute all audio
                this.updateMasterVolume(volume, true);
            } else {
                volumeValue.textContent = volume + '%';
                volumeDisplay.textContent = volume + '%';
                volumeControl.querySelector('.status-icon').textContent = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
                muteBtn.textContent = 'Mute';
                // Unmute all audio
                this.updateMasterVolume(volume, false);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!volumeControl.contains(e.target) && !volumeDropdown.contains(e.target)) {
                volumeDropdown.style.display = 'none';
            }
        });

        // Quill AI click handler
        const quillAiStatus = document.getElementById('network-status');
        if (quillAiStatus) {
            quillAiStatus.style.cursor = 'pointer';
            quillAiStatus.addEventListener('click', () => {
                this.openAIAssistant();
            });
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.style.cursor = 'pointer';
            let isFullscreen = false;
            
            fullscreenBtn.addEventListener('click', () => {
                isFullscreen = !isFullscreen;
                
                if (isFullscreen) {
                    // Enter fullscreen - hide background, make viewport fullscreen
                    const roomBg = document.querySelector('.room-background');
                    const crtMonitor = document.querySelector('.crt-monitor');
                    const monitorScreen = document.querySelector('.monitor-screen');
                    const screenContent = document.querySelector('.screen-content');
                    
                    roomBg.style.display = 'none';
                    crtMonitor.style.position = 'fixed';
                    crtMonitor.style.inset = '0';
                    crtMonitor.style.width = '100vw';
                    crtMonitor.style.height = '100vh';
                    crtMonitor.style.background = '#000';
                    monitorScreen.style.position = 'fixed';
                    monitorScreen.style.inset = '0';
                    monitorScreen.style.width = '100vw';
                    monitorScreen.style.height = '100vh';
                    monitorScreen.style.top = '0';
                    monitorScreen.style.left = '0';
                    monitorScreen.style.transform = 'none';
                    monitorScreen.style.clipPath = 'none';
                    monitorScreen.style.background = 'transparent';
                    screenContent.style.width = '100vw';
                    screenContent.style.height = '100vh';
                    screenContent.style.position = 'fixed';
                    screenContent.style.inset = '0';
                    screenContent.style.clipPath = 'none';
                    screenContent.style.background = 'var(--win-bg)';
                    
                    fullscreenBtn.querySelector('.status-icon').textContent = '⛶';
                    fullscreenBtn.querySelector('.status-value').textContent = 'Exit';
                    fullscreenBtn.title = 'Exit Fullscreen';
                    
                    // Request fullscreen API if available
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(err => {
                            console.log('Fullscreen error:', err);
                        });
                    }
                } else {
                    // Exit fullscreen - restore background and original styles
                    const roomBg = document.querySelector('.room-background');
                    const crtMonitor = document.querySelector('.crt-monitor');
                    const monitorScreen = document.querySelector('.monitor-screen');
                    const screenContent = document.querySelector('.screen-content');
                    
                    roomBg.style.display = '';
                    crtMonitor.style.position = '';
                    crtMonitor.style.inset = '';
                    crtMonitor.style.width = '';
                    crtMonitor.style.height = '';
                    crtMonitor.style.background = '';
                    monitorScreen.style.position = '';
                    monitorScreen.style.inset = '';
                    monitorScreen.style.width = '';
                    monitorScreen.style.height = '';
                    monitorScreen.style.top = '';
                    monitorScreen.style.left = '';
                    monitorScreen.style.transform = '';
                    monitorScreen.style.clipPath = '';
                    monitorScreen.style.background = '';
                    screenContent.style.width = '';
                    screenContent.style.height = '';
                    screenContent.style.position = '';
                    screenContent.style.inset = '';
                    screenContent.style.clipPath = '';
                    screenContent.style.background = '';
                    
                    fullscreenBtn.querySelector('.status-icon').textContent = '⛶';
                    fullscreenBtn.querySelector('.status-value').textContent = 'Fullscreen';
                    fullscreenBtn.title = 'Fullscreen';
                    
                    // Exit fullscreen API if available
                    if (document.exitFullscreen) {
                        document.exitFullscreen().catch(err => {
                            console.log('Exit fullscreen error:', err);
                        });
                    }
                }
            });
        }
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

    // Helper method to call OpenAI API
    // Uses Vercel proxy in production, direct API in local dev (if API key is set)
    async callOpenAI(endpoint, body) {
        // In local dev, use direct API if key is available
        if (this.isLocalDev && this.openaiApiKey) {
            try {
                const response = await fetch(`https://api.openai.com${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.openaiApiKey}`
                    },
                    body: JSON.stringify(body)
                });
                
                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'API request failed' }));
                    throw new Error(error.error?.message || error.error || `API request failed with status ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                throw error;
            }
        }
        
        // Otherwise, use Vercel proxy (production) or show error (local dev without key)
        try {
            const response = await fetch(this.apiProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ endpoint, body })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'API request failed' }));
                throw new Error(error.error || `API request failed with status ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            // If running locally and endpoint doesn't exist, provide helpful error
            if (this.isLocalDev && (error.message.includes('Failed to fetch') || error.message.includes('404') || error.name === 'TypeError')) {
                throw new Error('API key required for local development. Please enter your OpenAI API key.');
            }
            throw error;
        }
    }

    setupAIAssistant() {
        const aiApp = document.getElementById('ai-assistant-app');
        if (aiApp.dataset.setup) return;
        aiApp.dataset.setup = 'true';

        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const chatArea = document.getElementById('ai-chat-area');
        
        if (!input || !sendBtn || !chatArea) {
            console.error('Quill AI: Required elements not found');
            return;
        }
        
        // Show API key prompt if running locally and no key is set
        if (this.isLocalDev && !this.openaiApiKey) {
            const apiKeyPrompt = document.createElement('div');
            apiKeyPrompt.className = 'ai-message ai-system';
            apiKeyPrompt.style.marginTop = '8px';
            apiKeyPrompt.innerHTML = `
                <div class="message-text">
                    <strong>🔑 API Key Required for Local Development</strong><br>
                    <p style="margin: 8px 0;">To use Quill AI locally, please enter your OpenAI API key. It will be stored in your browser's localStorage.</p>
                    <div style="margin: 8px 0;">
                        <input type="password" id="api-key-input" placeholder="sk-proj-..." 
                               style="width: 100%; padding: 6px; margin: 4px 0; font-family: monospace; background: rgba(0,0,0,0.3); border: 1px solid #808080; color: #00ff00;">
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button id="save-api-key-btn" style="padding: 6px 12px; background: var(--win-selected); color: white; border: 1px outset var(--win-bg); cursor: pointer;">Save Key</button>
                            <a href="https://platform.openai.com/account/api-keys" target="_blank" 
                               style="padding: 6px 12px; background: var(--win-bg); color: var(--win-text); border: 1px outset var(--win-bg); text-decoration: none; display: inline-block;">Get Your Own</a>
                        </div>
                        <p style="margin-top: 8px; font-size: 10px; color: #88ff88;">Key is stored locally in your browser. On Vercel, the API key is set as an environment variable.</p>
                    </div>
                </div>
            `;
            chatArea.appendChild(apiKeyPrompt);
            
            // Handle API key input
            const apiKeyInput = document.getElementById('api-key-input');
            const saveApiKeyBtn = document.getElementById('save-api-key-btn');
            
            saveApiKeyBtn.addEventListener('click', () => {
                const apiKey = apiKeyInput.value.trim();
                if (apiKey && apiKey.startsWith('sk-')) {
                    localStorage.setItem('openaiApiKey', apiKey);
                    this.openaiApiKey = apiKey;
                    apiKeyPrompt.remove();
                    const successMsg = document.createElement('div');
                    successMsg.className = 'ai-message ai-system';
                    successMsg.innerHTML = '<div class="message-text"><strong>✓ API Key Saved!</strong> You can now use Quill AI.</div>';
                    chatArea.appendChild(successMsg);
                } else {
                    alert('Please enter a valid OpenAI API key (should start with "sk-")');
                }
            });
            
            apiKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveApiKeyBtn.click();
                }
            });
        }
        
        // Track writing flow state
        let waitingForWriteAnswers = false;
        let pendingWriteQuery = null;
        let pendingWriteFiles = [];
        let pendingWriteUrls = [];
        
        // API is now handled by Vercel serverless function - no API key needed from user
        const attachBtn = document.getElementById('ai-attach-btn');
        const fileInput = document.getElementById('ai-file-input');
        const urlInput = document.getElementById('ai-url-input');
        const attachmentsArea = document.getElementById('ai-attachments');
        let currentMode = 'chat'; // Default mode
        let attachedFiles = [];
        let attachedUrls = [];

        // Feature button handlers
        const featureButtons = document.querySelectorAll('.ai-feature-btn');
        featureButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                featureButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                currentMode = btn.dataset.feature;
                
                // Update placeholder based on mode
                const placeholders = {
                    'chat': 'Type your message...',
                    'image': 'Describe the image you want to generate...',
                    'web': 'Enter your search query...',
                    'code': 'Ask a coding question or request code...'
                };
                input.placeholder = placeholders[currentMode] || 'Type your message...';
            });
        });

        // Set default active button
        document.querySelector('.ai-feature-btn[data-feature="chat"]').classList.add('active');

        // Attachment button handler
        let attachMode = 'file'; // 'file' or 'url'
        attachBtn.addEventListener('click', () => {
            if (attachMode === 'file') {
                fileInput.click();
            } else {
                urlInput.style.display = urlInput.style.display === 'none' ? 'block' : 'none';
                if (urlInput.style.display === 'block') {
                    urlInput.focus();
                }
            }
        });

        // Toggle between file and URL mode (right-click or long press)
        attachBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            attachMode = attachMode === 'file' ? 'url' : 'file';
            attachBtn.title = attachMode === 'file' ? 'Attach file' : 'Attach URL';
        });

        // File input handler
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                attachedFiles.push(file);
                this.displayAttachment(file, attachmentsArea, 'file', attachedFiles.length - 1, 0);
            });
            fileInput.value = ''; // Reset input
        });

        // URL input handler
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = urlInput.value.trim();
                if (url && this.isValidUrl(url)) {
                    attachedUrls.push(url);
                    this.displayAttachment(url, attachmentsArea, 'url', 0, attachedUrls.length - 1);
                    urlInput.value = '';
                    urlInput.style.display = 'none';
                }
            }
        });

        // Remove attachment handler
        attachmentsArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-attachment')) {
                const attachmentItem = e.target.closest('.attachment-item');
                const index = parseInt(attachmentItem.dataset.index);
                const type = attachmentItem.dataset.type;
                
                if (type === 'file') {
                    attachedFiles.splice(index, 1);
                } else {
                    attachedUrls.splice(index, 1);
                }
                attachmentItem.remove();
                this.updateAttachmentsDisplay();
            }
        });

        const sendMessage = async () => {
            const query = input.value.trim();
            const hasAttachments = attachedFiles.length > 0 || attachedUrls.length > 0;
            
            if (!query && !hasAttachments) return;
            
            // If we're waiting for answers to a writing request, handle the answer
            if (waitingForWriteAnswers) {
                // Add user's answer to chat first
                const userMsg = document.createElement('div');
                userMsg.className = 'ai-message ai-user';
                userMsg.innerHTML = `<div class="message-text">${query}</div>`;
                chatArea.appendChild(userMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
                
                // Clear input
                input.value = '';
                
                // Check if we have enough info now - be more lenient
                const loadingMsg = document.createElement('div');
                loadingMsg.className = 'ai-message ai-assistant';
                loadingMsg.innerHTML = '<div class="message-text">Checking if I have enough information...</div>';
                chatArea.appendChild(loadingMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
                
                // After user answers once, proceed with interpretation (don't ask again)
                // We already asked questions once, now proceed with what we have
                const hasEnoughInfo = true; // Always proceed after first answer
                
                if (hasEnoughInfo) {
                    // We have enough info, proceed to write
                    waitingForWriteAnswers = false;
                    loadingMsg.innerHTML = '<div class="message-text">Writing in Write application...</div>';
                    chatArea.scrollTop = chatArea.scrollHeight;
                    
                    // Combine original query with user's answers
                    const fullQuery = `${pendingWriteQuery}\n\nUser's answers: ${query}`;
                    
                    // Get the written content
                    const writeContent = await this.getWriteContent(fullQuery, pendingWriteFiles, pendingWriteUrls);
                    
                    // Get conversational response for chat
                    await this.chatResponse(fullQuery, loadingMsg, chatArea, pendingWriteFiles, pendingWriteUrls, false);
                    
                    if (writeContent) {
                        // Write to Write app
                        await this.writeToWriteApp(writeContent, fullQuery);
                    }
                    
                    // Clear pending state
                    pendingWriteQuery = null;
                    pendingWriteFiles = [];
                    pendingWriteUrls = [];
                    input.placeholder = 'Type your message...';
                    
                    chatArea.scrollTop = chatArea.scrollHeight;
                    return;
                } else {
                    // User answered but AI thinks it needs more - proceed anyway with interpretation
                    // Only ask questions ONCE, then proceed with best interpretation
                    waitingForWriteAnswers = false;
                    loadingMsg.innerHTML = '<div class="message-text">Proceeding with my interpretation...</div>';
                    chatArea.scrollTop = chatArea.scrollHeight;
                    
                    // Combine original query with user's answers and proceed
                    const fullQuery = `${pendingWriteQuery}\n\nUser's answers: ${query}\n\nWrite the content based on what you understand, using your best judgment to interpret any vague aspects.`;
                    
                    // Get the written content
                    const writeContent = await this.getWriteContent(fullQuery, pendingWriteFiles, pendingWriteUrls);
                    
                    // Get conversational response for chat
                    await this.chatResponse(fullQuery, loadingMsg, chatArea, pendingWriteFiles, pendingWriteUrls, false);
                    
                    if (writeContent) {
                        // Write to Write app
                        await this.writeToWriteApp(writeContent, fullQuery);
                    }
                    
                    // Clear pending state
                    pendingWriteQuery = null;
                    pendingWriteFiles = [];
                    pendingWriteUrls = [];
                    input.placeholder = 'Type your message...';
                    
                    chatArea.scrollTop = chatArea.scrollHeight;
                    return;
                }
            }

            // Add user message with mode indicator and attachments
            const userMsg = document.createElement('div');
            userMsg.className = 'ai-message ai-user';
            const modeLabel = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
            let messageHtml = `<div class="message-text"><strong>[${modeLabel}]</strong> ${query || '(no text)'}</div>`;
            
            // Add attachments preview
            if (attachedFiles.length > 0 || attachedUrls.length > 0) {
                messageHtml += '<div class="attachments-preview">';
                attachedFiles.forEach((file, idx) => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const img = userMsg.querySelector(`.attachment-preview[data-file-index="${idx}"]`);
                            if (img) img.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; border: 1px solid #808080;">`;
                        };
                        reader.readAsDataURL(file);
                        messageHtml += `<div class="attachment-preview" data-file-index="${idx}">📷 ${file.name} (loading...)</div>`;
                    } else {
                        messageHtml += `<div class="attachment-preview">📄 ${file.name} (${(file.size / 1024).toFixed(1)}KB)</div>`;
                    }
                });
                attachedUrls.forEach((url, idx) => {
                    messageHtml += `<div class="attachment-preview">🔗 <a href="${url}" target="_blank">${url}</a></div>`;
                });
                messageHtml += '</div>';
            }
            
            userMsg.innerHTML = messageHtml;
            chatArea.appendChild(userMsg);

            // Store attachments for API call
            const filesToSend = [...attachedFiles];
            const urlsToSend = [...attachedUrls];

            // Clear input and attachments
            input.value = '';
            attachedFiles = [];
            attachedUrls = [];
            this.clearAttachments(attachmentsArea);

            // Scroll to bottom
            chatArea.scrollTop = chatArea.scrollHeight;

            // Show loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'ai-message ai-assistant';
            loadingMsg.innerHTML = '<div class="message-text">Processing...</div>';
            chatArea.appendChild(loadingMsg);
            chatArea.scrollTop = chatArea.scrollHeight;

            // Handle different modes with real API calls
            if (currentMode === 'image') {
                // Image generation with DALL-E (pass attachments for reference images)
                this.generateImage(query, loadingMsg, chatArea, filesToSend, urlsToSend);
            } else if (currentMode === 'web') {
                // Web search using chat API
                this.webSearch(query, loadingMsg, chatArea);
            } else if (currentMode === 'code') {
                // Code assistant
                this.codeAssistant(query, loadingMsg, chatArea);
            } else {
                // Regular chat with attachments
                // Check if Write document already has content
                const writeContentData = this.getWriteAppContent();
                const isReferencingWrite = writeContentData && this.isReferencingWrite(query, writeContentData);
                
                // Check if this is a writing request
                const isWritingRequest = this.detectWritingRequest(query);
                
                // If user is referencing existing Write content, work with it directly (no confirmation)
                // This check MUST come before writing request check to avoid asking for confirmation on existing content
                if (isReferencingWrite && writeContentData && writeContentData.text.length > 0) {
                    // User is referencing the Write document - handle it directly, no confirmation needed
                    await this.handleWriteDocumentRequest(query, loadingMsg, chatArea, filesToSend, urlsToSend, writeContentData);
                } else if (isWritingRequest && (!writeContentData || writeContentData.text.length === 0)) {
                    // New writing request - Write is empty, ask for confirmation
                    loadingMsg.innerHTML = `
                        <div class="message-text">
                            <strong>Would you like me to write this in the Write application?</strong><br>
                            <button class="ai-confirm-btn" id="write-yes-btn" style="margin: 4px 4px 4px 0; padding: 4px 12px; background: var(--win-selected); color: white; border: 1px outset var(--win-bg); cursor: pointer;">Yes</button>
                            <button class="ai-confirm-btn" id="write-no-btn" style="margin: 4px; padding: 4px 12px; background: var(--win-bg); color: var(--win-text); border: 1px outset var(--win-bg); cursor: pointer;">No</button>
                        </div>
                    `;
                    
                    // Set up button handlers
                    const yesBtn = document.getElementById('write-yes-btn');
                    const noBtn = document.getElementById('write-no-btn');
                    
                    yesBtn.addEventListener('click', async () => {
                        // Position windows side by side with equal space
                        this.positionWindowsForWrite();
                        
                        // Check if we need to ask questions or can proceed directly
                        loadingMsg.innerHTML = '<div class="message-text">Evaluating request...</div>';
                        chatArea.scrollTop = chatArea.scrollHeight;
                        
                        const needsQuestions = await this.checkInitialRequestNeedsQuestions(query, filesToSend, urlsToSend);
                        
                        if (!needsQuestions) {
                            // User has given enough info or wants Quill to choose - proceed directly
                            waitingForWriteAnswers = false;
                            loadingMsg.innerHTML = '<div class="message-text">Writing in Write application...</div>';
                            chatArea.scrollTop = chatArea.scrollHeight;
                            
                            // Get the written content
                            const writeContent = await this.getWriteContent(query, filesToSend, urlsToSend);
                            
                            // Get conversational response for chat
                            await this.chatResponse(query, loadingMsg, chatArea, filesToSend, urlsToSend, false);
                            
                            if (writeContent) {
                                // Write to Write app
                                await this.writeToWriteApp(writeContent, query);
                            }
                            
                            input.placeholder = 'Type your message...';
                            chatArea.scrollTop = chatArea.scrollHeight;
                        } else {
                            // Need to ask questions first
                            loadingMsg.innerHTML = '<div class="message-text">Asking questions first...</div>';
                            
                            // Ask questions only (don't write yet)
                            await this.askQuestionsOnly(query, loadingMsg, chatArea, filesToSend, urlsToSend);
                            
                            // Set flag that we're waiting for answers
                            waitingForWriteAnswers = true;
                            pendingWriteQuery = query;
                            pendingWriteFiles = [...filesToSend];
                            pendingWriteUrls = [...urlsToSend];
                            
                            // Update input placeholder to indicate we're waiting for answers
                            input.placeholder = 'Answer the questions above, then I\'ll write the content...';
                            
                            chatArea.scrollTop = chatArea.scrollHeight;
                        }
                    });
                    
                    noBtn.addEventListener('click', async () => {
                        // Normal chat flow
                        await this.chatResponse(query, loadingMsg, chatArea, filesToSend, urlsToSend);
                    });
                } else {
                    // Normal chat flow
                    await this.chatResponse(query, loadingMsg, chatArea, filesToSend, urlsToSend);
                }
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    async generateImage(prompt, loadingMsg, chatArea, files = [], urls = []) {
        try {
            let finalPrompt = prompt;
            
            // If there are reference images, analyze them first
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            const imageUrls = urls.filter(u => this.isImageUrl(u));
            
            let hasReference = false;
            let referenceDescription = '';
            
            if (imageFiles.length > 0 || imageUrls.length > 0) {
                // Analyze reference images using vision API
                const imageAnalyses = [];
                
                for (const file of imageFiles) {
                    const base64 = await this.fileToBase64(file);
                    const analysis = await this.analyzeImageWithVision(`data:${file.type};base64,${base64}`, prompt);
                    if (analysis) {
                        imageAnalyses.push(analysis);
                    }
                }
                
                for (const url of imageUrls) {
                    const analysis = await this.analyzeImageWithVision(url, prompt);
                    if (analysis) {
                        imageAnalyses.push(analysis);
                    }
                }
                
                // Combine analyses with the user's prompt
                if (imageAnalyses.length > 0) {
                    hasReference = true;
                    referenceDescription = imageAnalyses.join('\n\n');
                }
            }
            
            // Build the final prompt with better structure
            let enhancedPrompt;
            
            if (hasReference) {
                // When there's a reference, structure the prompt to emphasize accuracy
                enhancedPrompt = `Create a retro pixelated image in 1992 video game style. 

REFERENCE IMAGE DETAILS (MUST MATCH ACCURATELY):
${referenceDescription}

USER REQUEST: ${prompt}

IMPORTANT INSTRUCTIONS:
- Accurately recreate the subjects, composition, colors, and style from the reference image
- Apply the user's request while maintaining the reference image's core elements
- Style: 1992 video game graphics, 8-bit pixel art, low resolution 256x256 or 320x200, chunky blocky pixels, classic DOS game aesthetic, limited 16-color palette, dithering patterns, scanlines effect, CRT monitor look, pixelated texture, retro gaming style, early 1990s computer graphics
- Match the reference image's composition, colors, and subjects as closely as possible while incorporating the user's modifications`;
            } else {
                // Standard generation without reference
                enhancedPrompt = `Create a retro pixelated image: ${prompt}. Style: 1992 video game graphics, 8-bit pixel art, low resolution 256x256 or 320x200, chunky blocky pixels, classic DOS game aesthetic, limited 16-color palette, dithering patterns, scanlines effect, CRT monitor look, pixelated texture, retro gaming style, early 1990s computer graphics`;
            }
            
            const data = await this.callOpenAI('/v1/images/generations', {
                model: 'dall-e-3',
                prompt: enhancedPrompt,
                n: 1,
                size: '1024x1024',
                quality: 'standard',
                style: 'vivid'
            });
            loadingMsg.remove();

            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            
            if (data.error) {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${data.error.message}</div>`;
            } else if (data.data && data.data[0]) {
                const imageUrl = data.data[0].url;
                const imageId = 'img-' + Date.now();
                aiMsg.innerHTML = `
                    <div class="message-text">
                        <strong>Image Generated:</strong><br>
                        <div style="position: relative; display: inline-block; width: 100%;">
                            <img id="${imageId}" src="${imageUrl}" alt="Generated image" class="generated-image" style="max-width: 100%; border: 1px solid #808080; margin: 4px 0; image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; cursor: pointer;">
                            <button class="copy-btn" data-copy-type="image" data-copy-value="${imageUrl}" style="margin-top: 4px;">📋 Copy Image URL</button>
                        </div>
                    </div>
                `;
                // Add copy functionality
                const copyBtn = aiMsg.querySelector('.copy-btn');
                copyBtn.addEventListener('click', () => this.copyToClipboard(imageUrl, copyBtn));
                
                // Add context menu for saving image
                const img = aiMsg.querySelector(`#${imageId}`);
                this.setupImageContextMenu(img, imageUrl);
            } else {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> No image generated</div>`;
            }

            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        } catch (error) {
            loadingMsg.remove();
            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${error.message}</div>`;
            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    async webSearch(query, loadingMsg, chatArea) {
        try {
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a 1992-era assistant providing search results. Your knowledge cutoff is December 1992. Only provide information, websites, and resources that existed in 1992 or earlier. Format your response as search results with titles and brief descriptions, referencing early web, BBS systems, and 1992-era information sources.'
                    },
                    {
                        role: 'user',
                        content: `Search for information about: ${query}. Provide 3-5 relevant results from 1992 or earlier with titles and brief descriptions.`
                    }
                ],
                max_tokens: 500
            });
            loadingMsg.remove();

            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            
            if (data.error) {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${data.error.message}</div>`;
            } else if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content;
                aiMsg.innerHTML = `
                    <div class="message-text">
                        <strong>Web Search Results:</strong><br>
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                `;
            } else {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> No results</div>`;
            }

            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        } catch (error) {
            loadingMsg.remove();
            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${error.message}</div>`;
            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    async codeAssistant(query, loadingMsg, chatArea) {
        try {
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a 1992-era coding assistant. Provide code examples using programming languages and techniques from 1992 or earlier (C, C++, Pascal, BASIC, Assembly, DOS programming, etc.). Reference 1992-era libraries, APIs, and computing concepts. Format code in code blocks with retro-style comments.'
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                max_tokens: 1000
            });
            loadingMsg.remove();

            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            
            if (data.error) {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${data.error.message}</div>`;
            } else if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content;
                // Format code blocks with retro terminal style and copy buttons
                const codeBlocks = [];
                const formattedContent = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                    const codeText = code.trim();
                    const codeIndex = codeBlocks.length;
                    codeBlocks.push(codeText);
                    // Store code in data attribute (base64 encoded to avoid HTML issues)
                    const encodedCode = btoa(unescape(encodeURIComponent(codeText)));
                    const blockHtml = `<div style="position: relative;">
                        <div style="background: #000; color: #0F0; padding: 8px; font-family: 'Courier New', monospace; font-size: 10px; border: 1px solid #808080; margin: 4px 0; white-space: pre-wrap; overflow-x: auto;">${this.escapeHtml(codeText)}</div>
                        <button class="copy-btn" data-copy-type="code" data-code-encoded="${encodedCode}" style="margin-top: 4px;">📋 Copy Code</button>
                    </div>`;
                    return blockHtml;
                });
                aiMsg.innerHTML = `
                    <div class="message-text">
                        <strong>Code Assistant:</strong><br>
                        ${formattedContent.replace(/\n/g, '<br>')}
                    </div>
                `;
                // Add copy functionality to all code copy buttons
                aiMsg.querySelectorAll('.copy-btn[data-copy-type="code"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const encodedCode = btn.dataset.codeEncoded;
                        const codeText = decodeURIComponent(escape(atob(encodedCode)));
                        this.copyToClipboard(codeText, btn);
                    });
                });
            } else {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> No response</div>`;
            }

            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        } catch (error) {
            loadingMsg.remove();
            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${error.message}</div>`;
            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    displayAttachment(item, container, type, fileIndex, urlIndex) {
        container.style.display = 'block';
        const attachmentItem = document.createElement('div');
        attachmentItem.className = 'attachment-item';
        const index = type === 'file' ? fileIndex : urlIndex;
        attachmentItem.dataset.index = index;
        attachmentItem.dataset.type = type;
        
        if (type === 'file') {
            attachmentItem.innerHTML = `
                <span>📎 ${item.name}</span>
                <button class="remove-attachment">✕</button>
            `;
        } else {
            attachmentItem.innerHTML = `
                <span>🔗 ${item.substring(0, 40)}...</span>
                <button class="remove-attachment">✕</button>
            `;
        }
        container.appendChild(attachmentItem);
    }

    clearAttachments(container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }

    updateAttachmentsDisplay() {
        const attachmentsArea = document.getElementById('ai-attachments');
        if (attachedFiles.length === 0 && attachedUrls.length === 0) {
            this.clearAttachments(attachmentsArea);
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    isImageUrl(url) {
        return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image/');
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async getModelForAttachments(files, urls) {
        const hasImages = files.some(f => f.type.startsWith('image/')) || 
                         urls.some(u => this.isImageUrl(u));
        return hasImages ? 'gpt-4o' : 'gpt-4';
    }

    async buildMessagesWithAttachments(query, files, urls) {
        const messages = [
            {
                role: 'system',
                content: `You are Quill AI, a retro AI assistant from 1992. Your knowledge cutoff is December 1992. You only know about events, technology, and information from before or during 1992. You reference DOS, Windows 3.1, early internet (BBS, early web), 8-bit/16-bit gaming, floppy disks, dial-up modems, and other 1992-era computing. When asked about things after 1992, you respond as if you don't know about them yet, or reference them as "future" concepts. Keep responses concise, nostalgic, and in character as a 1992-era AI assistant.

IMPORTANT: You are running in a retro-inspired operating system interface. Here's what users can do:

INSIDE THE OS (Program Manager):
- Main Group: Read Me (project information), File Manager, Control Panel, Print Manager, Clipboard Viewer, DOS Prompt, Windows Setup, PIF Editor
- Games Group: Minesweeper, SkiFree, Solitaire, Doom
- Accessories Group: Write, Paintbrush, Terminal, Notepad, Recorder, Calendar, Calculator, Clock, Object Packager, Character Map, Media Player, Sound Recorder, Cardfile
- Startup Group: Programs that launch automatically on startup (customizable)
- Network Group: Network-related programs

OUTSIDE THE OS (Desktop/Background):
- VHS Player: Click the VHS deck area (bottom-right of monitor) to play retro music tracks. Click again to stop. Features include: Billy Ray Cyrus, En Vogue, Kome Kome Club, SNAP!, Алла Пугачёва, Группа крови, 悲しみは雪のように浜田 省吾
- Sticky Note: Yellow sticky note at bottom-left of monitor - hover over it to see it bend and hear a page turn sound effect
- Desktop Clock: Shows current time with analog clock face
- Volume Control: Status bar at bottom has volume slider (default 50%) - controls all audio (music, sound effects)
- Quill AI: You are accessible from desktop icon or status bar

FEATURES:
- All windows are draggable and resizable
- Windows can be minimized to taskbar
- MDI (Multiple Document Interface) for program groups
- Retro Windows 3.1 aesthetic throughout
- All audio respects master volume control
- Write Application Integration: When users ask you to write something (documents, paragraphs, letters, etc.), you can offer to write it directly in the Write application for them. The system will detect writing requests and prompt the user if they want to use Write.

When users ask what they can do, tell them about these features and how to access them.`
            }
        ];

        // Build user message with attachments
        const userContent = [];
        
        // Add text query if present
        if (query) {
            userContent.push({ type: 'text', text: query });
        }

        // Add image URLs
        for (const url of urls) {
            if (this.isImageUrl(url)) {
                userContent.push({
                    type: 'image_url',
                    image_url: { url: url }
                });
            } else {
                // For non-image URLs, add as text reference
                userContent.push({ type: 'text', text: `Please analyze this URL: ${url}` });
            }
        }

        // Process image files
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await this.fileToBase64(file);
                userContent.push({
                    type: 'image_url',
                    image_url: { url: `data:${file.type};base64,${base64}` }
                });
            } else {
                // For text files, read and include content
                try {
                    const text = await this.fileToText(file);
                    userContent.push({ type: 'text', text: `Content from ${file.name}:\n${text}` });
                } catch (err) {
                    userContent.push({ type: 'text', text: `File ${file.name} (${(file.size / 1024).toFixed(1)}KB) - unable to read content` });
                }
            }
        }

        // Add user message
        if (userContent.length === 1 && userContent[0].type === 'text') {
            messages.push({
                role: 'user',
                content: userContent[0].text
            });
        } else {
            messages.push({
                role: 'user',
                content: userContent
            });
        }

        return messages;
    }

    detectWritingRequest(query) {
        const writingKeywords = [
            'write', 'create a document', 'make a document', 'draft', 
            'compose', 'type', 'put in writing', 'document about',
            'paragraph about', 'essay about', 'letter about', 'note about',
            'write a', 'write an', 'write some', 'write about'
        ];
        const lowerQuery = query.toLowerCase();
        return writingKeywords.some(keyword => lowerQuery.includes(keyword));
    }

    getWriteAppContent() {
        // Get current content from Write app
        const writeWindow = document.getElementById('write-app');
        if (writeWindow && writeWindow.style.display !== 'none') {
            const editor = writeWindow.querySelector('.write-editor');
            if (editor) {
                // Get HTML content to preserve formatting
                const htmlContent = editor.innerHTML || '';
                // Also get text content for context
                const textContent = editor.innerText || editor.textContent || '';
                return {
                    html: htmlContent.trim(),
                    text: textContent.trim()
                };
            }
        }
        return null;
    }

    isReferencingWrite(query, writeContentData) {
        // Check if user is asking about/edit/referencing the Write content
        if (!writeContentData || writeContentData.text.length === 0) return false;
        
        const lowerQuery = query.toLowerCase();
        const referenceKeywords = [
            'the document', 'the essay', 'the paragraph', 'the letter', 'the text',
            'what i wrote', 'what you wrote', 'the content', 'in write', 'in the write app',
            'the write application', 'bold', 'italic', 'underline', 'format', 'edit',
            'change', 'modify', 'update', 'revise', 'rewrite', 'add to', 'remove from',
            'delete from', 'improve', 'fix', 'last paragraph', 'first paragraph', 'that paragraph',
            'this paragraph', 'the last', 'the first', 'make it', 'make the', 'can you',
            'could you', 'please', 'it', 'that', 'this', 'paragraph', 'sentence', 'word',
            'title', 'heading', 'line'
        ];
        
        // If Write has content and query contains formatting/editing keywords, it's a reference
        const hasFormattingKeywords = ['bold', 'italic', 'underline', 'format', 'edit', 'change', 'modify'].some(kw => lowerQuery.includes(kw));
        const hasReferenceWords = ['the', 'that', 'this', 'it', 'paragraph', 'document', 'essay'].some(kw => lowerQuery.includes(kw));
        
        // If it has formatting keywords OR reference words, and Write has content, it's a reference
        return hasFormattingKeywords || (hasReferenceWords && writeContentData.text.length > 0);
    }

    async handleWriteDocumentRequest(query, loadingMsg, chatArea, files = [], urls = [], writeContentData) {
        // Handle requests to work with the Write document
        try {
            const model = await this.getModelForAttachments(files, urls);
            const messages = await this.buildMessagesWithAttachments(query, files, urls);
            
            const writeText = writeContentData.text;
            const writeHtml = writeContentData.html;
            
            // Add Write content as context
            if (messages.length > 0 && messages[0].role === 'system') {
                messages[0].content += `\n\nIMPORTANT: The user has content in the Write application. Here is the current content:\n\n---Write Application Content (Text)---\n${writeText}\n---End of Write Content---\n\nYou have FULL access to the Write application and can:\n1. Read and reference the content\n2. Edit, modify, or rewrite any part\n3. Apply formatting: bold (<b>text</b>), italic (<i>text</i>), underline (<u>text</u>)\n4. Change alignment, add paragraphs, etc.\n\nCRITICAL FORMATTING INSTRUCTIONS: When the user asks you to modify, format, or edit the document (e.g., "bold the last paragraph", "make it italic", "format the title", "can you bold the last paragraph"), you MUST:\n\n1. Start your response with: "---UPDATED CONTENT---"\n2. Provide the COMPLETE updated document with HTML formatting applied to the requested parts\n3. Use HTML tags: <b>bold</b>, <i>italic</i>, <u>underline</u>, <br> for line breaks\n4. Include ALL the original content, not just the changed part\n5. Apply the requested formatting to the appropriate section (e.g., if they say "bold the last paragraph", make that paragraph bold in the full document)\n6. End with: "---END---"\n7. After the markers, you can add a brief explanation if needed\n\nExample format:\n---UPDATED CONTENT---\n<p>First paragraph here.</p>\n<p>Second paragraph here.</p>\n<p><b>Last paragraph here (now bolded).</b></p>\n---END---\n\nI've bolded the last paragraph as requested.\n\nWhen the user asks about "the document", "the essay", "what I wrote", etc., they are referring to this content. If they ask you to modify it, provide the full updated version with formatting between the markers.`;
            }
            
            // Also add Write content to user message for better context
            const lastUserMessage = messages[messages.length - 1];
            if (lastUserMessage && lastUserMessage.role === 'user') {
                if (typeof lastUserMessage.content === 'string') {
                    lastUserMessage.content = `[Context: The user has the following content in Write application:\n${writeText}\n]\n\n${lastUserMessage.content}`;
                } else if (Array.isArray(lastUserMessage.content)) {
                    const textItem = lastUserMessage.content.find(item => item.type === 'text');
                    if (textItem) {
                        textItem.text = `[Context: The user has the following content in Write application:\n${writeText}\n]\n\n${textItem.text}`;
                    }
                }
            }
            
            // Use proxy (streaming disabled for Vercel compatibility)
            loadingMsg.innerHTML = `<div class="message-text"><em>Processing...</em></div>`;
            
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: 2000,
                stream: false
            });

            const fullContent = data.choices?.[0]?.message?.content || '';

            loadingMsg.remove();

            // Check if the response contains updated content that should be written to Write app
            const needsWriteUpdate = this.shouldUpdateWriteDocument(query, fullContent);
            
            if (needsWriteUpdate) {
                // Extract the updated content (might be in the response)
                let updatedContent = this.extractWriteContent(fullContent, writeContentData.text);
                
                if (updatedContent) {
                    // Write updated content to Write app
                    await this.writeToWriteApp(updatedContent, query);
                    
                    // Show success message
                    const aiMsg = document.createElement('div');
                    aiMsg.className = 'ai-message ai-assistant';
                    aiMsg.innerHTML = `<div class="message-text">${fullContent.replace(/\n/g, '<br>')}<br><br><strong>✓ Updated in Write application</strong></div>`;
                    chatArea.appendChild(aiMsg);
                } else {
                    // Couldn't extract, show response normally
                    const aiMsg = document.createElement('div');
                    aiMsg.className = 'ai-message ai-assistant';
                    aiMsg.innerHTML = `<div class="message-text">${fullContent.replace(/\n/g, '<br>')}</div>`;
                    chatArea.appendChild(aiMsg);
                }
            } else {
                // Just show the response
                const aiMsg = document.createElement('div');
                aiMsg.className = 'ai-message ai-assistant';
                aiMsg.innerHTML = `<div class="message-text">${fullContent.replace(/\n/g, '<br>')}</div>`;
                chatArea.appendChild(aiMsg);
            }

            chatArea.scrollTop = chatArea.scrollHeight;
        } catch (error) {
            loadingMsg.remove();
            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${error.message}</div>`;
            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    shouldUpdateWriteDocument(query, response) {
        // Determine if the response should update the Write document
        const lowerQuery = query.toLowerCase();
        const lowerResponse = response.toLowerCase();
        
        const updateKeywords = [
            'bold', 'italic', 'underline', 'format', 'edit', 'change', 'modify',
            'update', 'revise', 'rewrite', 'add', 'remove', 'delete', 'improve',
            'fix', 'make it', 'make the', 'apply', 'set'
        ];
        
        // Check if user asked to modify AND response contains formatted content or HTML
        const askedToModify = updateKeywords.some(keyword => lowerQuery.includes(keyword));
        const hasFormattedContent = response.includes('<b>') || response.includes('<i>') || 
                                   response.includes('<u>') || response.includes('**') ||
                                   response.includes('*') || response.length > 100;
        
        return askedToModify && hasFormattedContent;
    }

    extractWriteContent(response, originalContent) {
        // Try to extract the updated content from the response
        
        // First, look for content between markers (---UPDATED CONTENT---)
        const markerMatch = response.match(/---UPDATED CONTENT---\s*([\s\S]*?)---END---/i);
        if (markerMatch && markerMatch[1]) {
            return markerMatch[1].trim();
        }
        
        // Look for content between any --- markers
        const docMarkers = response.match(/---[\s\S]*?---/);
        if (docMarkers && docMarkers[0].length > 50) {
            let content = docMarkers[0].replace(/---/g, '').trim();
            if (content.length > originalContent.length * 0.5) {
                return content;
            }
        }
        
        // If response contains HTML tags and is substantial, extract HTML content
        if (response.includes('<b>') || response.includes('<i>') || response.includes('<u>')) {
            // Find the HTML content section
            const htmlSection = response.match(/(<[^>]+>[\s\S]*<\/[^>]+>)/);
            if (htmlSection && htmlSection[1].length > originalContent.length * 0.5) {
                return htmlSection[1];
            }
            
            // If entire response is mostly HTML formatted content
            if (response.match(/<[^>]+>/g) && response.match(/<[^>]+>/g).length > 2) {
                // Clean up conversational prefixes but keep HTML
                let cleaned = response.replace(/^[^<]*/, ''); // Remove text before first HTML tag
                if (cleaned.length > originalContent.length * 0.5) {
                    return cleaned.trim();
                }
            }
        }
        
        // If response is mostly the updated content (longer than 80% of original), use it
        if (response.length > originalContent.length * 0.8) {
            // Clean up conversational prefixes
            let cleaned = response.replace(/^[^<\n]*:\s*/i, ''); // Remove "Here's the updated:" etc
            cleaned = cleaned.replace(/^[^<\n]*\n\n/, ''); // Remove intro text
            // Remove trailing conversational text
            cleaned = cleaned.replace(/\n\n[^<]*$/i, ''); // Remove trailing text after content
            if (cleaned.length > originalContent.length * 0.5) {
                return cleaned.trim();
            }
        }
        
        return null;
    }

    positionWindowsForWrite() {
        const screenContent = document.querySelector('.screen-content');
        const statusBar = document.querySelector('.desktop-status-bar');
        const screenRect = screenContent.getBoundingClientRect();
        const statusBarHeight = statusBar ? statusBar.offsetHeight : 0;
        const offset = 8;
        const gap = 8; // Gap between windows
        const availableWidth = screenRect.width - (offset * 2) - gap;
        const windowWidth = Math.floor(availableWidth / 2); // Equal space for both windows
        const windowHeight = screenRect.height - statusBarHeight - (offset * 2);
        
        // Ensure Quill AI is open and positioned on the left
        const aiApp = document.getElementById('ai-assistant-app');
        if (aiApp) {
            aiApp.style.display = 'flex';
            aiApp.style.left = `${offset}px`;
            aiApp.style.top = `${offset}px`;
            aiApp.style.width = `${windowWidth}px`;
            aiApp.style.height = `${windowHeight}px`;
            aiApp.style.position = 'absolute';
            this.setupWindowDrag(aiApp);
            this.setupSingleWindowControls(aiApp);
            this.focusWindow(aiApp);
        }
        
        // Open and position Write app on the right side
        this.openAccessory('write');
        
        setTimeout(() => {
            const writeWindow = document.getElementById('write-app');
            if (writeWindow) {
                writeWindow.style.display = 'flex';
                writeWindow.style.left = `${offset + windowWidth + gap}px`;
                writeWindow.style.top = `${offset}px`;
                writeWindow.style.width = `${windowWidth}px`;
                writeWindow.style.height = `${windowHeight}px`;
                writeWindow.style.position = 'absolute';
                this.setupWindowDrag(writeWindow);
                this.setupSingleWindowControls(writeWindow);
            }
        }, 50);
    }

    async getWriteContent(query, files = [], urls = []) {
        // Get ONLY the written content without any questions or explanations
        try {
            const model = await this.getModelForAttachments(files, urls);
            const messages = await this.buildMessagesWithAttachments(query, files, urls);
            
            // Modify the system message to ask for ONLY written content
            if (messages.length > 0 && messages[0].role === 'system') {
                messages[0].content += '\n\nIMPORTANT: When the user asks you to write something (essay, document, paragraph, letter, etc.), provide ONLY the written content itself. Do NOT include any questions, explanations, introductions, or conversational text. Just provide the actual written content that should go in the document.';
            }
            
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: 2000
            });
            
            if (data.choices && data.choices[0]) {
                let content = data.choices[0].message.content;
                
                // Try to extract just the written content by removing common conversational prefixes
                // Remove things like "Absolutely! Would you like me to..." or "Here's the essay:" etc.
                const conversationalPrefixes = [
                    /^Absolutely!.*?Would you like me to.*?\n\n/gi,
                    /^Here'?s (the|your|a).*?:\n\n/gi,
                    /^I'?ll.*?:\n\n/gi,
                    /^Let me.*?:\n\n/gi,
                    /^For your.*?,\s*/gi,
                    /^Remember,.*?\n\n/gi,
                    /^Is there.*?\?/gi,
                    /^Absolutely!.*?\n\n/gi
                ];
                
                conversationalPrefixes.forEach(pattern => {
                    content = content.replace(pattern, '');
                });
                
                // Remove trailing questions or conversational text
                content = content.replace(/\n\nIs there.*$/gi, '');
                content = content.replace(/\n\nRemember,.*$/gi, '');
                
                return content.trim();
            }
            return null;
        } catch (error) {
            console.error('Error getting write content:', error);
            return null;
        }
    }

    async askQuestionsOnly(query, loadingMsg, chatArea, files = [], urls = []) {
        // Intelligently determine if questions are needed or if we can proceed
        try {
            const model = await this.getModelForAttachments(files, urls);
            const messages = await this.buildMessagesWithAttachments(query, files, urls);
            
            // Let the AI intelligently decide - ask questions only if truly needed for clarification
            if (messages.length > 0 && messages[0].role === 'system') {
                messages[0].content += '\n\nThe user wants you to write something. Be intelligent:\n\n- If the request is clear enough to write something reasonable, respond with: "I have enough information to proceed."\n- Only ask 2-3 clarifying questions if the request is genuinely vague or ambiguous and you need clarification to write something meaningful.\n- Trust your ability to interpret and be creative - you can make reasonable assumptions.\n- If you\'re unsure but can still write something reasonable, proceed rather than asking.\n\nRespond with "I have enough information to proceed." if you can write, or ask questions ONLY if you truly need clarification.';
            }
            
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: 500
            });
            loadingMsg.remove();

            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            
            if (data.error) {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${data.error.message}</div>`;
            } else if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content;
                aiMsg.innerHTML = `<div class="message-text">${content.replace(/\n/g, '<br>')}</div>`;
            } else {
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> No response</div>`;
            }

            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        } catch (error) {
            loadingMsg.remove();
            const aiMsg = document.createElement('div');
            aiMsg.className = 'ai-message ai-assistant';
            aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${error.message}</div>`;
            chatArea.appendChild(aiMsg);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    async checkIfEnoughInfo(originalQuery, userAnswer, files = [], urls = []) {
        // Intelligently check if we have enough information to write - no hardcoded rules
        try {
            const model = await this.getModelForAttachments(files, urls);
            const messages = await this.buildMessagesWithAttachments(
                `${originalQuery}\n\nUser's answer: ${userAnswer}`,
                files,
                urls
            );
            
            // Let AI understand context and intent naturally - be decisive
            if (messages.length > 0 && messages[0].role === 'system') {
                messages[0].content += '\n\nBased on the original request and the user\'s answer, determine if you have enough information to write. Be decisive:\n\n- Default to YES - if you have reasonable information or creative freedom, you have enough.\n- Only say NO if you ABSOLUTELY cannot write something reasonable.\n- Trust your ability to be creative and make reasonable assumptions.\n- Consider user intent - they want you to write, so proceed when possible.\n\nRespond with ONLY "YES" if you can write (which should be most cases), or "NO" only if you truly cannot proceed.';
            }
            
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: 150
            });
            
            if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content.trim().toUpperCase();
                // Check if response indicates we have enough info
                return content.startsWith('YES') || content.includes('ENOUGH') || content.includes('PROCEED') || content.includes('SUFFICIENT');
            }
            // Default to proceeding if unsure - trust the AI's judgment
            return true;
        } catch (error) {
            console.error('Error checking if enough info:', error);
            // If check fails, proceed - better to write than to get stuck
            return true;
        }
    }
    
    async checkInitialRequestNeedsQuestions(query, files = [], urls = []) {
        // Intelligently determine if the initial request needs questions - no hardcoded rules
        try {
            const model = await this.getModelForAttachments(files, urls);
            const messages = await this.buildMessagesWithAttachments(query, files, urls);
            
            // Let AI understand user intent - ask questions only if clarification is truly needed
            if (messages.length > 0 && messages[0].role === 'system') {
                messages[0].content += '\n\nThe user wants you to write something. Evaluate intelligently:\n\n- If the request is clear enough or you can interpret it reasonably, respond with: "I have enough information to proceed."\n- Only ask for clarification if the request is genuinely vague or ambiguous and you need specific details to write meaningfully.\n- Trust your ability to interpret and create - you can make reasonable assumptions.\n- If you can write something reasonable even with some ambiguity, proceed.\n\nRespond with "I have enough information to proceed." if you can write, or ask questions ONLY if you truly need clarification to write something meaningful.';
            }
            
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: 250
            });
            
            if (data.choices && data.choices[0]) {
                const content = data.choices[0].message.content.trim().toUpperCase();
                // Check if response indicates we have enough info (no questions needed)
                const hasEnough = content.includes('ENOUGH INFORMATION') || content.includes('PROCEED') || content.includes('SUFFICIENT');
                return !hasEnough; // Return true if we NEED questions, false if we can proceed
            }
            // Default to asking questions if unsure - better to clarify than assume
            return true;
        } catch (error) {
            console.error('Error checking initial request:', error);
            // If check fails, ask questions to be safe
            return true;
        }
    }

    async writeToWriteApp(content, userQuery) {
        // Wait for Write window to be ready, then populate it
        setTimeout(() => {
            const writeWindow = document.getElementById('write-app');
            if (writeWindow) {
                // Make sure Write window is open
                writeWindow.style.display = 'flex';
                this.positionWindowsForWrite();
                
                const editor = writeWindow.querySelector('.write-editor');
                if (editor) {
                    // Check if content already has HTML formatting
                    let formattedContent = content;
                    
                    // If content doesn't have HTML tags, convert line breaks
                    if (!content.includes('<') || !content.match(/<[^>]+>/)) {
                        formattedContent = content.replace(/\n/g, '<br>');
                    }
                    
                    // Clear existing content and add new content
                    editor.innerHTML = formattedContent;
                    editor.focus();
                    // Move cursor to end
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    editor.scrollTop = editor.scrollHeight;
                }
            }
        }, 300);
    }

    async chatResponse(query, loadingMsg, chatArea, files = [], urls = [], skipDisplay = false) {
        try {
            const model = await this.getModelForAttachments(files, urls);
            const messages = await this.buildMessagesWithAttachments(query, files, urls);
            
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: 1000
            });
            loadingMsg.remove();

            let content = null;
            
            if (data.choices && data.choices[0]) {
                content = data.choices[0].message.content;
            }

            if (!skipDisplay) {
                const aiMsg = document.createElement('div');
                aiMsg.className = 'ai-message ai-assistant';
                
                if (data.error) {
                    aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${data.error.message}</div>`;
                } else if (content) {
                    aiMsg.innerHTML = `<div class="message-text">${content.replace(/\n/g, '<br>')}</div>`;
                } else {
                    aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> No response</div>`;
                }

                chatArea.appendChild(aiMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
            } else {
                // Still add a placeholder message that will be replaced
                const aiMsg = document.createElement('div');
                aiMsg.className = 'ai-message ai-assistant';
                aiMsg.innerHTML = `<div class="message-text">Processing...</div>`;
                chatArea.appendChild(aiMsg);
            }
            
            // Return object with content
            return {
                content: content
            };
        } catch (error) {
            loadingMsg.remove();
            if (!skipDisplay) {
                const aiMsg = document.createElement('div');
                aiMsg.className = 'ai-message ai-assistant';
                aiMsg.innerHTML = `<div class="message-text"><strong>Error:</strong> ${error.message}</div>`;
                chatArea.appendChild(aiMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
            }
            return { content: null };
        }
    }

    copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            button.style.background = '#0F0';
            button.style.color = '#000';
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
                button.style.color = '';
            }, 2000);
        }).catch(err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                const originalText = button.textContent;
                button.textContent = '✓ Copied!';
                button.style.background = '#0F0';
                button.style.color = '#000';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '';
                    button.style.color = '';
                }, 2000);
            } catch (err) {
                alert('Failed to copy');
            }
            document.body.removeChild(textArea);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupImageContextMenu(img, imageUrl) {
        let contextMenu = null;

        img.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove existing menu if present
            if (contextMenu) {
                contextMenu.remove();
                contextMenu = null;
                return;
            }

            // Create context menu
            contextMenu = document.createElement('div');
            contextMenu.className = 'image-context-menu';
            contextMenu.innerHTML = `
                <div class="context-menu-item" data-action="save">💾 Save Image</div>
                <div class="context-menu-item" data-action="copy-url">📋 Copy URL</div>
                <div class="context-menu-item" data-action="open">🔗 Open in New Tab</div>
            `;

            // Position menu at cursor
            const chatArea = document.getElementById('ai-chat-area');
            const chatRect = chatArea.getBoundingClientRect();
            contextMenu.style.left = (e.clientX - chatRect.left) + 'px';
            contextMenu.style.top = (e.clientY - chatRect.top) + 'px';

            chatArea.appendChild(contextMenu);

            // Handle menu actions
            contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    if (action === 'save') {
                        this.saveImage(imageUrl, img);
                    } else if (action === 'copy-url') {
                        this.copyToClipboard(imageUrl, item);
                    } else if (action === 'open') {
                        window.open(imageUrl, '_blank');
                    }
                    contextMenu.remove();
                    contextMenu = null;
                });
            });

            // Close menu on outside click
            setTimeout(() => {
                const closeMenu = (e) => {
                    if (contextMenu && !contextMenu.contains(e.target) && e.target !== img) {
                        contextMenu.remove();
                        contextMenu = null;
                        document.removeEventListener('click', closeMenu);
                    }
                };
                document.addEventListener('click', closeMenu);
            }, 0);
        });
    }

    saveImage(imageUrl, imgElement) {
        // Try to use the img element's current source first (handles CORS better)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions to match image
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        
        // Draw image to canvas
        ctx.drawImage(imgElement, 0, 0);
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `quill-image-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                // Fallback to fetch if canvas method fails
                fetch(imageUrl, { mode: 'cors' })
                    .then(response => {
                        if (!response.ok) throw new Error('Network response was not ok');
                        return response.blob();
                    })
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `quill-image-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    })
                    .catch(err => {
                        console.error('Error saving image:', err);
                        alert('Failed to save image. Please try right-clicking the image and selecting "Save Image As" instead.');
                    });
            }
        }, 'image/png');
    }

    async analyzeImageWithVision(imageUrl, userRequest) {
        try {
            const data = await this.callOpenAI('/v1/chat/completions', {
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `You are analyzing a reference image that will be used to generate a new image. The user's request is: "${userRequest}"

Provide an EXTREMELY detailed and structured analysis of this reference image. Include:

1. SUBJECTS AND CHARACTERS: Describe every person, character, or main subject in detail - their appearance, clothing, pose, expression, position in frame, size relative to image
2. COMPOSITION: Exact layout, positioning of elements, perspective, camera angle, framing
3. COLORS AND PALETTE: Specific color names and where they appear, dominant colors, color scheme, lighting
4. STYLE AND AESTHETIC: Art style, visual treatment, mood, atmosphere
5. BACKGROUND AND ENVIRONMENT: Detailed description of setting, objects, textures, details
6. SPECIFIC VISUAL ELEMENTS: Any distinctive features, patterns, textures, or unique characteristics

Be extremely specific and detailed. The goal is to recreate this image accurately with the user's modifications. Format your response as a clear, structured description that can be directly used in image generation.`
                                },
                                {
                                    type: 'image_url',
                                    image_url: { url: imageUrl }
                                }
                            ]
                        }
                    ],
                    max_tokens: 800
                });

            if (data.choices && data.choices[0]) {
                return data.choices[0].message.content;
            }
            return null;
        } catch (error) {
            console.error('Error analyzing image:', error);
            return null;
        }
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
            // Use selected year instead of current year
            const displayYear = this.selectedYear || 1992;
            dateElement.textContent = `${dayName}, ${monthName} ${date}, ${displayYear}`;
        }
    }

    setupYearSelector() {
        const dateElement = document.getElementById('status-date');
        if (!dateElement) return;

        // Make date clickable
        dateElement.style.cursor = 'pointer';
        dateElement.title = 'Click to change year';

        dateElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showYearSelectorDialog();
        });
    }

    showYearSelectorDialog() {
        // Remove existing dialog if present
        const existingDialog = document.getElementById('year-selector-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Create dialog
        const dialog = document.createElement('div');
        dialog.id = 'year-selector-dialog';
        dialog.className = 'year-selector-dialog';
        dialog.innerHTML = `
            <div class="dialog-titlebar">
                <span class="dialog-title">Select Year</span>
                <button class="dialog-close-btn" id="year-dialog-close">✕</button>
            </div>
            <div class="dialog-content">
                <div class="dialog-text">Choose a year to travel through time:</div>
                <div class="year-options">
                    <button class="year-btn" data-year="1985">1985</button>
                    <button class="year-btn" data-year="1992">1992</button>
                    <button class="year-btn" data-year="1995">1995</button>
                    <button class="year-btn" data-year="1998">1998</button>
                    <button class="year-btn" data-year="2000">2000</button>
                    <button class="year-btn" data-year="2001">2001</button>
                </div>
            </div>
        `;

        document.querySelector('.screen-content').appendChild(dialog);

        // Position dialog
        const screenContent = document.querySelector('.screen-content');
        const rect = screenContent.getBoundingClientRect();
        dialog.style.left = (rect.width / 2 - 150) + 'px';
        dialog.style.top = (rect.height / 2 - 100) + 'px';

        // Close button
        document.getElementById('year-dialog-close').addEventListener('click', () => {
            dialog.remove();
        });

        // Year buttons
        dialog.querySelectorAll('.year-btn').forEach(btn => {
            const year = parseInt(btn.dataset.year);
            if (year === this.selectedYear) {
                btn.classList.add('selected');
            }
            
            btn.addEventListener('click', () => {
                this.selectedYear = year;
                localStorage.setItem('selectedYear', year.toString());
                this.applyYearTheme(year);
                dialog.remove();
                this.updateStatusBar();
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dialog.contains(e.target) && e.target !== document.getElementById('status-date')) {
                dialog.remove();
            }
        }, { once: true });
    }

    applyYearTheme(year) {
        const body = document.body;
        const roomBackground = document.querySelector('.room-background');
        
        // Remove existing year classes
        body.classList.remove('year-1985', 'year-1992', 'year-1995', 'year-1998', 'year-2000', 'year-2001');
        roomBackground.classList.remove('year-1985', 'year-1992', 'year-1995', 'year-1998', 'year-2000', 'year-2001');

        // Add year class
        body.classList.add(`year-${year}`);
        roomBackground.classList.add(`year-${year}`);

        // Apply year-specific theme
        // For now, we'll set up the structure - you can add different monitor images and themes later
        // Example: if (year === 1995) { roomBackground.style.backgroundImage = 'url(assets/monitor-1995.png)'; }
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

    getAppIconClass(windowId) {
        // Map window IDs to their icon classes
        const iconMap = {
            'minesweeper-app': 'minesweeper-icon',
            'skifree-app': 'skifree-icon',
            'solitaire-app': 'solitaire-icon',
            'doom-app': 'doom-icon',
            'readme-app': 'readme-icon',
            'desktop-clock': 'clock-icon',
            'write-app': 'write-icon',
            'paintbrush-app': 'paintbrush-icon',
            'terminal-app': 'terminal-icon',
            'notepad-app': 'notepad-icon',
            'recorder-app': 'recorder-icon',
            'calendar-app': 'calendar-icon',
            'calculator-app': 'calculator-icon',
            'clock-app': 'clock-icon',
            'object-packager-app': 'packager-icon',
            'character-map-app': 'charmap-icon',
            'media-player-app': 'mediaplayer-icon',
            'sound-recorder-app': 'soundrec-icon',
            'cardfile-app': 'cardfile-icon',
            'ai-assistant-app': 'quill-icon-image'
        };
        
        return iconMap[windowId] || null;
    }

    addToTaskbar(windowId, title, window) {
        const taskbar = document.querySelector('.desktop-taskbar');
        if (!taskbar) return;
        
        // Don't add Program Manager to taskbar - it has its own icon
        if (windowId === 'program-manager') return;
        
        // Only add application windows to taskbar, not program group windows
        // Allow desktop-clock as it's a special case
        if (!window.classList.contains('application-window') && windowId !== 'desktop-clock') return;
        
        // Check if already in taskbar
        if (this.minimizedWindows.has(windowId)) return;
        
        // Get the appropriate icon class
        const iconClass = this.getAppIconClass(windowId);
        
        let iconHTML;
        if (iconClass === 'quill-icon-image') {
            // Special case: Quill AI uses an image
            iconHTML = `<img src="assets/quill.png" alt="Quill AI" class="quill-icon-image" style="width: 32px; height: 32px; object-fit: contain;">`;
        } else if (iconClass) {
            // Use the actual app icon
            iconHTML = `<div class="app-icon ${iconClass}"></div>`;
        } else {
            // Fallback to placeholder
            iconHTML = `<div class="mini-window-icon"></div>`;
        }
        
        const taskbarItem = document.createElement('div');
        taskbarItem.className = 'taskbar-item';
        taskbarItem.dataset.windowId = windowId;
        taskbarItem.innerHTML = `
            <div class="taskbar-item-image">
                ${iconHTML}
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
                } else if (app === 'readme') {
                    this.openReadme();
                } else if (app === 'write' || app === 'paintbrush' || app === 'terminal' || 
                           app === 'notepad' || app === 'recorder' || app === 'calendar' ||
                           app === 'calculator' || app === 'clock' || app === 'object-packager' ||
                           app === 'character-map' || app === 'media-player' || 
                           app === 'sound-recorder' || app === 'cardfile') {
                    this.openAccessory(app);
                }
            });

            // Right-click context menu to add/remove from startup
            icon.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const app = icon.dataset.app;
                if (!app) return;
                
                // Determine app ID
                let appId = app;
                if (app === 'write' || app === 'paintbrush' || app === 'terminal' || 
                    app === 'notepad' || app === 'recorder' || app === 'calendar' ||
                    app === 'calculator' || app === 'clock' || app === 'object-packager' ||
                    app === 'character-map' || app === 'media-player' || 
                    app === 'sound-recorder' || app === 'cardfile') {
                    appId = `accessory-${app}`;
                }
                
                const isInStartup = this.isInStartup(appId);
                const menu = document.createElement('div');
                menu.className = 'dropdown-menu';
                menu.innerHTML = isInStartup 
                    ? `<div class="menu-option" data-action="remove-startup">Remove from StartUp</div>`
                    : `<div class="menu-option" data-action="add-startup">Add to StartUp</div>`;
                
                const rect = icon.getBoundingClientRect();
                menu.style.left = `${rect.left}px`;
                menu.style.top = `${rect.bottom}px`;
                
                menu.querySelector('.menu-option').addEventListener('click', () => {
                    if (isInStartup) {
                        this.removeFromStartup(appId);
                    } else {
                        this.addToStartup(appId);
                    }
                    menu.remove();
                });
                
                document.body.appendChild(menu);
                
                // Close on outside click
                setTimeout(() => {
                    const closeHandler = (e) => {
                        if (!menu.contains(e.target) && !icon.contains(e.target)) {
                            menu.remove();
                            document.removeEventListener('click', closeHandler);
                        }
                    };
                    document.addEventListener('click', closeHandler);
                }, 0);
            });
        });
    }

    openMinesweeper() {
        const minesweeperApp = document.getElementById('minesweeper-app');
        if (!minesweeperApp) return;

        if (minesweeperApp.style.display === 'none' || !minesweeperApp.style.display) {
            minesweeperApp.style.display = 'flex';
            const pos = this.getStandaloneWindowPosition();
            // Always position at top-left, flush with edge
            minesweeperApp.style.left = `${pos.left}px`;
            minesweeperApp.style.top = `${pos.top}px`;
            minesweeperApp.style.width = '300px';
            minesweeperApp.style.height = 'auto';
            minesweeperApp.style.position = 'absolute';
            minesweeperApp.style.right = 'auto';
            minesweeperApp.style.bottom = 'auto';
            this.setupWindowDrag(minesweeperApp);
            this.setupSingleWindowControls(minesweeperApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('minesweeper-app');
            
            // Initialize game if not already initialized
            if (!minesweeperApp.dataset.initialized) {
                this.initMinesweeper();
                minesweeperApp.dataset.initialized = 'true';
            }
        } else {
            // Window is already open, ensure it's at the correct position
            const pos = this.getStandaloneWindowPosition();
            minesweeperApp.style.left = `${pos.left}px`;
            minesweeperApp.style.top = `${pos.top}px`;
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(minesweeperApp);
    }

    openReadme() {
        const readmeApp = document.getElementById('readme-app');
        if (!readmeApp) return;

        if (readmeApp.style.display === 'none' || !readmeApp.style.display) {
            readmeApp.style.display = 'flex';
            const pos = this.getStandaloneWindowPosition();
            readmeApp.style.left = `${pos.left}px`;
            readmeApp.style.top = `${pos.top}px`;
            readmeApp.style.width = '500px';
            readmeApp.style.height = '400px';
            readmeApp.style.position = 'absolute';
            readmeApp.style.right = 'auto';
            readmeApp.style.bottom = 'auto';
            this.setupWindowDrag(readmeApp);
            this.setupSingleWindowControls(readmeApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('readme-app');
        } else {
            // Window is already open, ensure it's at the correct position
            const pos = this.getStandaloneWindowPosition();
            readmeApp.style.left = `${pos.left}px`;
            readmeApp.style.top = `${pos.top}px`;
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(readmeApp);
    }

    getAccessoryContent(appName) {
        const contents = {
            'calculator': `
                <div class="calculator-app">
                    <input type="text" class="calc-display" id="calc-display" value="0" readonly>
                    <div class="calc-buttons">
                        <button class="calc-btn calc-clear" data-action="clear">C</button>
                        <button class="calc-btn calc-op" data-action="backspace">←</button>
                        <button class="calc-btn calc-op" data-op="%">%</button>
                        <button class="calc-btn calc-op" data-op="/">÷</button>
                        <button class="calc-btn" data-num="7">7</button>
                        <button class="calc-btn" data-num="8">8</button>
                        <button class="calc-btn" data-num="9">9</button>
                        <button class="calc-btn calc-op" data-op="*">×</button>
                        <button class="calc-btn" data-num="4">4</button>
                        <button class="calc-btn" data-num="5">5</button>
                        <button class="calc-btn" data-num="6">6</button>
                        <button class="calc-btn calc-op" data-op="-">−</button>
                        <button class="calc-btn" data-num="1">1</button>
                        <button class="calc-btn" data-num="2">2</button>
                        <button class="calc-btn" data-num="3">3</button>
                        <button class="calc-btn calc-op" data-op="+">+</button>
                        <button class="calc-btn" data-num="0" style="grid-column: span 2;">0</button>
                        <button class="calc-btn" data-num=".">.</button>
                        <button class="calc-btn calc-equals" data-action="equals">=</button>
                    </div>
                </div>`,
            'notepad': `
                <div class="notepad-app">
                    <div class="notepad-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>E</u>dit</span>
                        <span class="menu-item"><u>S</u>earch</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <textarea class="notepad-textarea" placeholder="Type here..."></textarea>
                </div>`,
            'terminal': `
                <div class="terminal-app">
                    <div class="terminal-output" id="terminal-output">DOS Version 6.22<br>(C)Copyright 1981-1994.<br><br>C:\\SYSTEM></div>
                    <div class="terminal-input-line">
                        <span class="terminal-prompt">C:\\WINDOWS></span>
                        <input type="text" class="terminal-input" id="terminal-input" autofocus>
                    </div>
                </div>`,
            'calendar': `
                <div class="calendar-app">
                    <div class="calendar-header">
                        <button class="calendar-nav" id="cal-prev">◄</button>
                        <span class="calendar-title" id="cal-title"></span>
                        <button class="calendar-nav" id="cal-next">►</button>
                    </div>
                    <div class="calendar-weekdays">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                    </div>
                    <div class="calendar-days" id="cal-days"></div>
                </div>`,
            'write': `
                <div class="write-app">
                    <div class="write-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>E</u>dit</span>
                        <span class="menu-item"><u>Ch</u>aracter</span>
                        <span class="menu-item"><u>P</u>aragraph</span>
                        <span class="menu-item"><u>D</u>ocument</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="write-toolbar">
                        <button class="write-btn" data-cmd="bold"><b>B</b></button>
                        <button class="write-btn" data-cmd="italic"><i>I</i></button>
                        <button class="write-btn" data-cmd="underline"><u>U</u></button>
                        <span class="write-sep">|</span>
                        <button class="write-btn" data-cmd="justifyLeft">≡</button>
                        <button class="write-btn" data-cmd="justifyCenter">≡</button>
                        <button class="write-btn" data-cmd="justifyRight">≡</button>
                    </div>
                    <div class="write-editor" contenteditable="true"></div>
                </div>`,
            'paintbrush': `
                <div class="paintbrush-app">
                    <div class="paint-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>E</u>dit</span>
                        <span class="menu-item"><u>V</u>iew</span>
                        <span class="menu-item"><u>O</u>ptions</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="paint-toolbar">
                        <div class="paint-tools">
                            <button class="paint-tool active" data-tool="brush" title="Brush">🖌</button>
                            <button class="paint-tool" data-tool="eraser" title="Eraser">⌫</button>
                            <button class="paint-tool" data-tool="fill" title="Fill">🪣</button>
                        </div>
                        <div class="paint-colors">
                            <div class="paint-color active" data-color="#000000" style="background:#000000"></div>
                            <div class="paint-color" data-color="#FFFFFF" style="background:#FFFFFF"></div>
                            <div class="paint-color" data-color="#FF0000" style="background:#FF0000"></div>
                            <div class="paint-color" data-color="#00FF00" style="background:#00FF00"></div>
                            <div class="paint-color" data-color="#0000FF" style="background:#0000FF"></div>
                            <div class="paint-color" data-color="#FFFF00" style="background:#FFFF00"></div>
                            <div class="paint-color" data-color="#FF00FF" style="background:#FF00FF"></div>
                            <div class="paint-color" data-color="#00FFFF" style="background:#00FFFF"></div>
                        </div>
                        <input type="range" class="paint-size" min="1" max="20" value="5" title="Brush Size">
                    </div>
                    <canvas class="paint-canvas" width="380" height="250"></canvas>
                </div>`,
            'character-map': `
                <div class="charmap-app">
                    <div class="charmap-grid" id="charmap-grid"></div>
                    <div class="charmap-preview">
                        <span class="charmap-char" id="charmap-selected">A</span>
                        <input type="text" class="charmap-input" id="charmap-input" readonly>
                        <button class="charmap-copy" id="charmap-copy">Copy</button>
                    </div>
                </div>`,
            'media-player': `
                <div class="mediaplayer-app">
                    <div class="mp-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>D</u>evice</span>
                        <span class="menu-item"><u>S</u>cale</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="mp-display">
                        <span class="mp-title">No file loaded</span>
                        <span class="mp-time">00:00 / 00:00</span>
                    </div>
                    <div class="mp-controls">
                        <button class="mp-btn" data-action="prev">⏮</button>
                        <button class="mp-btn mp-play" data-action="play">▶</button>
                        <button class="mp-btn" data-action="stop">⏹</button>
                        <button class="mp-btn" data-action="next">⏭</button>
                    </div>
                    <input type="range" class="mp-progress" min="0" max="100" value="0">
                    <div class="mp-volume">
                        <span>🔊</span>
                        <input type="range" class="mp-vol-slider" min="0" max="100" value="75">
                    </div>
                </div>`,
            'sound-recorder': `
                <div class="soundrec-app">
                    <div class="sr-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>E</u>dit</span>
                        <span class="menu-item"><u>E</u>ffects</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="sr-display">
                        <canvas class="sr-waveform" width="300" height="60"></canvas>
                        <span class="sr-time">00:00.00</span>
                    </div>
                    <div class="sr-controls">
                        <button class="sr-btn" data-action="rewind">⏪</button>
                        <button class="sr-btn" data-action="play">▶</button>
                        <button class="sr-btn" data-action="stop">⏹</button>
                        <button class="sr-btn sr-record" data-action="record">⏺</button>
                    </div>
                    <div class="sr-status">Stopped</div>
                </div>`,
            'cardfile': `
                <div class="cardfile-app">
                    <div class="cf-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>E</u>dit</span>
                        <span class="menu-item"><u>V</u>iew</span>
                        <span class="menu-item"><u>C</u>ard</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="cf-tabs" id="cf-tabs">
                        <div class="cf-tab active" data-index="0">A</div>
                        <div class="cf-tab" data-index="1">B</div>
                        <div class="cf-tab" data-index="2">C</div>
                        <div class="cf-tab" data-index="3">+</div>
                    </div>
                    <div class="cf-card">
                        <input type="text" class="cf-title" placeholder="Card Title" value="Address Book">
                        <textarea class="cf-content" placeholder="Card content...">Name: John Doe
Phone: 555-1234
Address: 123 Main St</textarea>
                    </div>
                </div>`,
            'recorder': `
                <div class="recorder-app">
                    <div class="rec-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>M</u>acro</span>
                        <span class="menu-item"><u>O</u>ptions</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="rec-status">Ready to record macros</div>
                    <div class="rec-controls">
                        <button class="rec-btn" data-action="record">⏺ Record</button>
                        <button class="rec-btn" data-action="stop" disabled>⏹ Stop</button>
                        <button class="rec-btn" data-action="play" disabled>▶ Play</button>
                    </div>
                    <div class="rec-list">
                        <div class="rec-item">Macro 1 - 3 actions</div>
                        <div class="rec-item">Macro 2 - 5 actions</div>
                    </div>
                </div>`,
            'object-packager': `
                <div class="packager-app">
                    <div class="pkg-menu-bar">
                        <span class="menu-item"><u>F</u>ile</span>
                        <span class="menu-item"><u>E</u>dit</span>
                        <span class="menu-item"><u>H</u>elp</span>
                    </div>
                    <div class="pkg-icon">📦</div>
                    <div class="pkg-text">Drag and drop a file here<br>to create a package</div>
                    <div class="pkg-buttons">
                        <button class="pkg-btn" data-action="import">Import...</button>
                        <button class="pkg-btn" data-action="export">Export...</button>
                    </div>
                </div>`
        };
        return contents[appName] || `<div style="padding: 20px; text-align: center;">${appName} - Coming Soon</div>`;
    }

    getAccessorySize(appName) {
        const sizes = {
            'calculator': { width: 220, height: 320 },
            'notepad': { width: 450, height: 350 },
            'terminal': { width: 500, height: 300 },
            'calendar': { width: 280, height: 300 },
            'write': { width: 500, height: 400 },
            'paintbrush': { width: 420, height: 360 },
            'character-map': { width: 380, height: 320 },
            'media-player': { width: 350, height: 200 },
            'sound-recorder': { width: 350, height: 180 },
            'cardfile': { width: 350, height: 280 },
            'recorder': { width: 300, height: 250 },
            'object-packager': { width: 300, height: 250 }
        };
        return sizes[appName] || { width: 400, height: 300 };
    }

    showFileDialog(mode, appName, callback) {
        const dialog = document.getElementById('file-dialog');
        const title = dialog.querySelector('#file-dialog-title');
        const filename = dialog.querySelector('#file-dialog-filename');
        const okBtn = dialog.querySelector('#file-dialog-ok');
        const cancelBtn = dialog.querySelector('#file-dialog-cancel');
        const closeBtn = dialog.querySelector('#file-dialog-close');
        
        title.textContent = mode === 'save' ? 'Save As' : 'Open';
        filename.value = mode === 'save' ? 'UNTITLED' : '';
        dialog.style.display = 'flex';
        
        const close = () => dialog.style.display = 'none';
        
        okBtn.onclick = () => {
            const name = filename.value || 'UNTITLED';
            close();
            callback(name);
        };
        
        cancelBtn.onclick = close;
        closeBtn.onclick = close;
        
        // Close on escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async saveFile(content, filename, mimeType) {
        try {
            if ('showSaveFilePicker' in window) {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'File',
                        accept: { [mimeType]: ['.txt', '.html', '.wri', '.bmp', '.png', '.wav', '.rec', '.crd'] }
                    }]
                });
                const writable = await fileHandle.createWritable();
                if (content instanceof Blob) {
                    await writable.write(content);
                } else {
                    await writable.write(content);
                }
                await writable.close();
            } else {
                let blob;
                if (content instanceof Blob) {
                    blob = content;
                } else {
                    blob = new Blob([content], { type: mimeType });
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Save failed:', err);
            }
        }
    }

    async loadFile(mimeTypes) {
        try {
            if ('showOpenFilePicker' in window) {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{ accept: mimeTypes }]
                });
                const file = await fileHandle.getFile();
                return file;
            } else {
                return new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = Object.keys(mimeTypes).map(key => mimeTypes[key].join(',')).join(',');
                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (file) resolve(file);
                        else resolve(null);
                    };
                    input.click();
                });
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Load failed:', err);
            }
            return null;
        }
    }

    showMenu(menuItem, menuItems, callback) {
        // Remove existing menus
        document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
        
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';
        menu.innerHTML = menuItems.map(item => 
            `<div class="menu-option ${item.disabled ? 'disabled' : ''}" data-action="${item.action}">${item.label}</div>`
        ).join('');
        
        const rect = menuItem.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom}px`;
        
        menu.querySelectorAll('.menu-option').forEach(opt => {
            if (!opt.classList.contains('disabled')) {
                opt.addEventListener('click', () => {
                    callback(opt.dataset.action);
                    menu.remove();
                });
            }
        });
        
        document.body.appendChild(menu);
        
        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && !menuItem.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    }

    initAccessory(appName, appWindow) {
        if (appName === 'calculator') {
            this.initCalculator(appWindow);
        } else if (appName === 'terminal') {
            this.initTerminal(appWindow);
        } else if (appName === 'calendar') {
            this.initCalendar(appWindow);
        } else if (appName === 'paintbrush') {
            this.initPaintbrush(appWindow);
        } else if (appName === 'character-map') {
            this.initCharacterMap(appWindow);
        } else if (appName === 'write') {
            this.initWrite(appWindow);
        } else if (appName === 'notepad') {
            this.initNotepad(appWindow);
        } else if (appName === 'cardfile') {
            this.initCardfile(appWindow);
        } else if (appName === 'media-player') {
            this.initMediaPlayer(appWindow);
        } else if (appName === 'sound-recorder') {
            this.initSoundRecorder(appWindow);
        } else if (appName === 'recorder') {
            this.initRecorder(appWindow);
        } else if (appName === 'object-packager') {
            this.initObjectPackager(appWindow);
        }
    }

    initCalculator(appWindow) {
        const display = appWindow.querySelector('#calc-display');
        let current = '0';
        let operator = null;
        let previous = null;
        let shouldReset = false;

        appWindow.querySelectorAll('.calc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = btn.dataset.num;
                const op = btn.dataset.op;
                const action = btn.dataset.action;

                if (num !== undefined) {
                    if (current === '0' || shouldReset) {
                        current = num;
                        shouldReset = false;
                    } else {
                        current += num;
                    }
                    display.value = current;
                } else if (op) {
                    if (previous !== null && operator && !shouldReset) {
                        current = String(eval(`${previous} ${operator} ${current}`));
                        display.value = current;
                    }
                    previous = current;
                    operator = op;
                    shouldReset = true;
                } else if (action === 'clear') {
                    current = '0';
                    previous = null;
                    operator = null;
                    display.value = '0';
                } else if (action === 'backspace') {
                    current = current.slice(0, -1) || '0';
                    display.value = current;
                } else if (action === 'equals') {
                    if (previous !== null && operator) {
                        try {
                            current = String(eval(`${previous} ${operator} ${current}`));
                            display.value = current;
                        } catch { display.value = 'Error'; current = '0'; }
                        previous = null;
                        operator = null;
                    }
                }
            });
        });
    }

    initTerminal(appWindow) {
        const output = appWindow.querySelector('#terminal-output');
        const input = appWindow.querySelector('#terminal-input');
        const commands = {
            'help': 'Available commands: help, dir, cls, date, time, ver, echo, type',
            'dir': 'Volume in drive C is SYSTEM\n Directory of C:\\SYSTEM\n\n.              <DIR>\n..             <DIR>\nAPPS           <DIR>\nCONFIG.INI        2048\nSYSTEM.INI        1536\n     2 File(s)     3,584 bytes\n     3 Dir(s)  104,857,600 bytes free',
            'cls': '__CLEAR__',
            'date': `Current date is ${new Date().toLocaleDateString()}`,
            'time': `Current time is ${new Date().toLocaleTimeString()}`,
            'ver': 'DOS Version 6.22',
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value.trim().toLowerCase();
                let response = '';
                
                if (cmd.startsWith('echo ')) {
                    response = cmd.slice(5);
                } else if (commands[cmd]) {
                if (commands[cmd] === '__CLEAR__') {
                    output.innerHTML = 'C:\\SYSTEM>';
                    input.value = '';
                    return;
                }
                    response = commands[cmd];
                } else if (cmd) {
                    response = `Bad command or file name`;
                }
                
                output.innerHTML += input.value + '<br>' + (response ? response.replace(/\n/g, '<br>') + '<br>' : '') + '<br>C:\\SYSTEM>';
                input.value = '';
                output.scrollTop = output.scrollHeight;
            }
        });
    }

    initCalendar(appWindow) {
        const title = appWindow.querySelector('#cal-title');
        const daysContainer = appWindow.querySelector('#cal-days');
        const prevBtn = appWindow.querySelector('#cal-prev');
        const nextBtn = appWindow.querySelector('#cal-next');
        
        let currentDate = new Date();
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

        function render() {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            title.textContent = `${months[month]} ${year}`;
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();
            
            let html = '';
            for (let i = 0; i < firstDay; i++) html += '<span></span>';
            for (let d = 1; d <= daysInMonth; d++) {
                const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                html += `<span class="${isToday ? 'today' : ''}">${d}</span>`;
            }
            daysContainer.innerHTML = html;
        }

        prevBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); render(); });
        nextBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); render(); });
        render();
    }

    initPaintbrush(appWindow) {
        const canvas = appWindow.querySelector('.paint-canvas');
        const ctx = canvas.getContext('2d');
        let painting = false;
        let color = '#000000';
        let brushSize = 5;
        let tool = 'brush';
        let currentFile = null;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        canvas.addEventListener('mousedown', (e) => { painting = true; draw(e); });
        canvas.addEventListener('mouseup', () => painting = false);
        canvas.addEventListener('mouseleave', () => painting = false);
        canvas.addEventListener('mousemove', draw);

        function draw(e) {
            if (!painting) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            ctx.beginPath();
            ctx.arc(x, y, brushSize, 0, Math.PI * 2);
            ctx.fillStyle = tool === 'eraser' ? '#FFFFFF' : color;
            ctx.fill();
        }

        appWindow.querySelectorAll('.paint-color').forEach(el => {
            el.addEventListener('click', () => {
                appWindow.querySelectorAll('.paint-color').forEach(c => c.classList.remove('active'));
                el.classList.add('active');
                color = el.dataset.color;
            });
        });

        appWindow.querySelectorAll('.paint-tool').forEach(el => {
            el.addEventListener('click', () => {
                appWindow.querySelectorAll('.paint-tool').forEach(t => t.classList.remove('active'));
                el.classList.add('active');
                tool = el.dataset.tool;
            });
        });

        appWindow.querySelector('.paint-size').addEventListener('input', (e) => brushSize = e.target.value);

        // File menu
        const fileMenu = appWindow.querySelector('.paint-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'new', label: 'New' },
                    { action: 'open', label: 'Open...' },
                    { action: 'save', label: 'Save' },
                    { action: 'saveas', label: 'Save As...' }
                ], async (action) => {
                    if (action === 'save' || action === 'saveas') {
                        this.showFileDialog('save', 'paintbrush', (filename) => {
                            canvas.toBlob((blob) => {
                                this.saveFile(blob, filename + '.bmp', 'image/bmp');
                                currentFile = filename;
                            }, 'image/bmp');
                        });
                    } else if (action === 'open') {
                        const file = await this.loadFile({ 'image/*': ['.bmp', '.png', '.jpg'] });
                        if (file) {
                            const img = new Image();
                            img.onload = () => {
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                ctx.drawImage(img, 0, 0);
                            };
                            img.src = URL.createObjectURL(file);
                            currentFile = file.name.replace(/\.[^/.]+$/, '');
                        }
                    } else if (action === 'new') {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        currentFile = null;
                    }
                });
            });
        }
    }

    initCharacterMap(appWindow) {
        const grid = appWindow.querySelector('#charmap-grid');
        const selected = appWindow.querySelector('#charmap-selected');
        const input = appWindow.querySelector('#charmap-input');
        const copyBtn = appWindow.querySelector('#charmap-copy');

        let html = '';
        for (let i = 33; i <= 126; i++) html += `<span class="charmap-cell" data-char="${String.fromCharCode(i)}">${String.fromCharCode(i)}</span>`;
        for (let i = 161; i <= 255; i++) html += `<span class="charmap-cell" data-char="${String.fromCharCode(i)}">${String.fromCharCode(i)}</span>`;
        grid.innerHTML = html;

        grid.addEventListener('click', (e) => {
            if (e.target.classList.contains('charmap-cell')) {
                const char = e.target.dataset.char;
                selected.textContent = char;
                input.value += char;
            }
        });

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(input.value);
            input.select();
        });
    }

    initWrite(appWindow) {
        const editor = appWindow.querySelector('.write-editor');
        let currentFile = null;
        
        appWindow.querySelectorAll('.write-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.execCommand(btn.dataset.cmd, false, null);
            });
        });
        
        // File menu
        const fileMenu = appWindow.querySelector('.write-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'new', label: 'New' },
                    { action: 'open', label: 'Open...' },
                    { action: 'save', label: 'Save' },
                    { action: 'saveas', label: 'Save As...' }
                ], async (action) => {
                    if (action === 'save' || action === 'saveas') {
                        this.showFileDialog('save', 'write', (filename) => {
                            const content = editor.innerHTML;
                            this.saveFile(content, filename + '.wri', 'text/html');
                            currentFile = filename;
                        });
                    } else if (action === 'open') {
                        const file = await this.loadFile({ 'text/html': ['.wri', '.html', '.txt'] });
                        if (file) {
                            const text = await file.text();
                            editor.innerHTML = text;
                            currentFile = file.name.replace(/\.[^/.]+$/, '');
                        }
                    } else if (action === 'new') {
                        editor.innerHTML = '';
                        currentFile = null;
                    }
                });
            });
        }
    }

    initCardfile(appWindow) {
        const title = appWindow.querySelector('.cf-title');
        const content = appWindow.querySelector('.cf-content');
        let currentFile = null;
        
        const fileMenu = appWindow.querySelector('.cf-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'new', label: 'New' },
                    { action: 'open', label: 'Open...' },
                    { action: 'save', label: 'Save' },
                    { action: 'saveas', label: 'Save As...' }
                ], async (action) => {
                    if (action === 'save' || action === 'saveas') {
                        this.showFileDialog('save', 'cardfile', (filename) => {
                            const data = JSON.stringify({ title: title.value, content: content.value });
                            this.saveFile(data, filename + '.crd', 'application/json');
                            currentFile = filename;
                        });
                    } else if (action === 'open') {
                        const file = await this.loadFile({ 'application/json': ['.crd'] });
                        if (file) {
                            const text = await file.text();
                            const data = JSON.parse(text);
                            title.value = data.title || '';
                            content.value = data.content || '';
                            currentFile = file.name.replace(/\.[^/.]+$/, '');
                        }
                    } else if (action === 'new') {
                        title.value = '';
                        content.value = '';
                        currentFile = null;
                    }
                });
            });
        }
    }

    initMediaPlayer(appWindow) {
        const title = appWindow.querySelector('.mp-title');
        let currentFile = null;
        
        const fileMenu = appWindow.querySelector('.mp-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'open', label: 'Open...' }
                ], async (action) => {
                    if (action === 'open') {
                        const file = await this.loadFile({ 'audio/*': ['.wav', '.mp3'], 'video/*': ['.avi', '.mp4'] });
                        if (file) {
                            title.textContent = file.name;
                            currentFile = file;
                            // In a real implementation, you'd load and play the media file
                        }
                    }
                });
            });
        }
    }

    initSoundRecorder(appWindow) {
        let currentFile = null;
        
        const fileMenu = appWindow.querySelector('.sr-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'new', label: 'New' },
                    { action: 'open', label: 'Open...' },
                    { action: 'save', label: 'Save' },
                    { action: 'saveas', label: 'Save As...' }
                ], async (action) => {
                    if (action === 'save' || action === 'saveas') {
                        this.showFileDialog('save', 'sound-recorder', (filename) => {
                            // In a real implementation, you'd save the recorded audio
                            // For now, create a placeholder
                            const blob = new Blob([''], { type: 'audio/wav' });
                            this.saveFile(blob, filename + '.wav', 'audio/wav');
                            currentFile = filename;
                        });
                    } else if (action === 'open') {
                        const file = await this.loadFile({ 'audio/*': ['.wav'] });
                        if (file) {
                            currentFile = file;
                            // In a real implementation, you'd load and play the audio
                        }
                    } else if (action === 'new') {
                        currentFile = null;
                    }
                });
            });
        }
    }

    initRecorder(appWindow) {
        let currentFile = null;
        
        const fileMenu = appWindow.querySelector('.rec-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'new', label: 'New' },
                    { action: 'open', label: 'Open...' },
                    { action: 'save', label: 'Save' },
                    { action: 'saveas', label: 'Save As...' }
                ], async (action) => {
                    if (action === 'save' || action === 'saveas') {
                        this.showFileDialog('save', 'recorder', (filename) => {
                            // Save macro data
                            const macroData = JSON.stringify({ macros: [] });
                            this.saveFile(macroData, filename + '.rec', 'application/json');
                            currentFile = filename;
                        });
                    } else if (action === 'open') {
                        const file = await this.loadFile({ 'application/json': ['.rec'] });
                        if (file) {
                            currentFile = file;
                            // In a real implementation, you'd load the macros
                        }
                    } else if (action === 'new') {
                        currentFile = null;
                    }
                });
            });
        }
    }

    initObjectPackager(appWindow) {
        const importBtn = appWindow.querySelector('.pkg-btn[data-action="import"]');
        const exportBtn = appWindow.querySelector('.pkg-btn[data-action="export"]');
        
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                const file = await this.loadFile({ '*/*': ['.*'] });
                if (file) {
                    // In a real implementation, you'd import the file
                    appWindow.querySelector('.pkg-text').textContent = `Package: ${file.name}`;
                }
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.showFileDialog('save', 'object-packager', (filename) => {
                    // In a real implementation, you'd export the package
                    const blob = new Blob([''], { type: 'application/octet-stream' });
                    this.saveFile(blob, filename + '.pkg', 'application/octet-stream');
                });
            });
        }
        
        const fileMenu = appWindow.querySelector('.pkg-menu-bar .menu-item');
        if (fileMenu && fileMenu.textContent.includes('File')) {
            fileMenu.addEventListener('click', () => {
                this.showMenu(fileMenu, [
                    { action: 'import', label: 'Import...' },
                    { action: 'export', label: 'Export...' }
                ], async (action) => {
                    if (action === 'import') {
                        const file = await this.loadFile({ '*/*': ['.*'] });
                        if (file) {
                            appWindow.querySelector('.pkg-text').textContent = `Package: ${file.name}`;
                        }
                    } else if (action === 'export') {
                        this.showFileDialog('save', 'object-packager', (filename) => {
                            const blob = new Blob([''], { type: 'application/octet-stream' });
                            this.saveFile(blob, filename + '.pkg', 'application/octet-stream');
                        });
                    }
                });
            });
        }
    }

    openAccessory(appName) {
        // Special case: Clock connects to the existing desktop clock
        if (appName === 'clock') {
            const clockWindow = document.getElementById('desktop-clock');
            if (clockWindow) {
                if (clockWindow.style.display === 'none') {
                    clockWindow.style.display = 'flex';
                }
                this.focusWindow(clockWindow);
                return;
            }
        }

        const appTitles = {
            'write': 'Write',
            'paintbrush': 'Paintbrush',
            'terminal': 'Terminal',
            'notepad': 'Notepad',
            'recorder': 'Recorder',
            'calendar': 'Calendar',
            'calculator': 'Calculator',
            'clock': 'Clock',
            'object-packager': 'Object Packager',
            'character-map': 'Character Map',
            'media-player': 'Media Player',
            'sound-recorder': 'Sound Recorder',
            'cardfile': 'Cardfile'
        };

        const title = appTitles[appName] || appName;
        const windowId = `${appName}-app`;
        let appWindow = document.getElementById(windowId);
        
        if (!appWindow) {
            const screenContent = document.querySelector('.retro-desktop');
            if (!screenContent) return;
            
            appWindow = document.createElement('div');
            appWindow.id = windowId;
            appWindow.className = 'application-window window';
            appWindow.style.display = 'none';
            
            appWindow.innerHTML = `
                <div class="window-titlebar">
                    <div class="system-menu">─</div>
                    <span class="window-title">${title}</span>
                    <div class="window-controls">
                        <button class="window-btn">▼</button>
                        <button class="window-btn">▲</button>
                    </div>
                </div>
                <div class="window-content">${this.getAccessoryContent(appName)}</div>
            `;
            
            screenContent.appendChild(appWindow);
            this.initAccessory(appName, appWindow);
        }

        const size = this.getAccessorySize(appName);
        if (appWindow.style.display === 'none' || !appWindow.style.display) {
            appWindow.style.display = 'flex';
            const pos = this.getStandaloneWindowPosition();
            appWindow.style.left = `${pos.left}px`;
            appWindow.style.top = `${pos.top}px`;
            appWindow.style.width = `${size.width}px`;
            appWindow.style.height = `${size.height}px`;
            appWindow.style.position = 'absolute';
            appWindow.style.right = 'auto';
            appWindow.style.bottom = 'auto';
            this.setupWindowDrag(appWindow);
            this.setupSingleWindowControls(appWindow);
        }
        
        this.focusWindow(appWindow);
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
            const pos = this.getStandaloneWindowPosition();
            solitaireApp.style.left = `${pos.left}px`;
            solitaireApp.style.top = `${pos.top}px`;
            solitaireApp.style.width = '620px';
            solitaireApp.style.height = '520px';
            solitaireApp.style.position = 'absolute';
            solitaireApp.style.right = 'auto';
            solitaireApp.style.bottom = 'auto';
            this.setupWindowDrag(solitaireApp);
            this.setupSingleWindowControls(solitaireApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('solitaire-app');
            
            // Initialize game if not already initialized
            if (!solitaireApp.dataset.initialized) {
                this.initSolitaire();
                solitaireApp.dataset.initialized = 'true';
            }
        } else {
            // Window is already open, ensure it's at the correct position
            const pos = this.getStandaloneWindowPosition();
            solitaireApp.style.left = `${pos.left}px`;
            solitaireApp.style.top = `${pos.top}px`;
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
            const pos = this.getStandaloneWindowPosition();
            skifreeApp.style.left = `${pos.left}px`;
            skifreeApp.style.top = `${pos.top}px`;
            skifreeApp.style.width = '420px';
            skifreeApp.style.height = '430px';
            skifreeApp.style.position = 'absolute';
            skifreeApp.style.right = 'auto';
            skifreeApp.style.bottom = 'auto';
            this.setupWindowDrag(skifreeApp);
            this.setupSingleWindowControls(skifreeApp);
            
            // Remove from taskbar if it was there
            this.removeFromTaskbar('skifree-app');
            
            // Initialize game if not already initialized
            if (!skifreeApp.dataset.initialized) {
                this.initSkiFree();
                skifreeApp.dataset.initialized = 'true';
            }
        } else {
            // Window is already open, ensure it's at the correct position
            const pos = this.getStandaloneWindowPosition();
            skifreeApp.style.left = `${pos.left}px`;
            skifreeApp.style.top = `${pos.top}px`;
        }
        
        // Always bring to front when opening/clicking
        this.focusWindow(skifreeApp);
    }

    openDoom() {
        const doomApp = document.getElementById('doom-app');
        if (!doomApp) return;

        if (doomApp.style.display === 'none' || !doomApp.style.display) {
            doomApp.style.display = 'flex';
            const pos = this.getStandaloneWindowPosition();
            doomApp.style.left = `${pos.left}px`;
            doomApp.style.top = `${pos.top}px`;
            doomApp.style.width = '520px';
            doomApp.style.height = '420px';
            doomApp.style.position = 'absolute';
            doomApp.style.right = 'auto';
            doomApp.style.bottom = 'auto';
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
            win.style.bottom = '';
        } else {
            win.classList.add('maximized');
            const statusBar = document.querySelector('.desktop-status-bar');
            const statusBarHeight = statusBar ? statusBar.offsetHeight : 24;
            const screenPadding = 8; // Padding from screen-content
            win.style.width = `calc(100% - ${screenPadding * 2}px)`;
            win.style.height = `calc(100% - ${statusBarHeight + screenPadding}px)`;
            win.style.left = `${screenPadding}px`;
            win.style.top = `${screenPadding}px`;
            win.style.bottom = `${statusBarHeight}px`;
        }
    }

    openProgramGroup(groupId) {
        const windowId = `${groupId}-window`;
        const win = document.getElementById(windowId);
        
        if (win) {
            if (win.style.display === 'none' || !win.style.display) {
                win.style.display = 'flex';
                const pos = this.getNextMdiPosition();
                win.style.left = `${pos.left}px`;
                win.style.top = `${pos.top}px`;
                win.style.zIndex = ++this.zIndex;
                this.setupWindowDrag(win);
                this.setupSingleWindowControls(win);
                // Remove from taskbar if it was there
                this.removeFromTaskbar(windowId);
                
                // Update startup window if it's startup
                if (groupId === 'startup') {
                    this.updateStartupWindow();
                }
            }
            this.focusWindow(win);
        }
    }

    loadStartupPrograms() {
        const startupPrograms = JSON.parse(localStorage.getItem('startupPrograms') || '[]');
        startupPrograms.forEach(appId => {
            // Small delay between launches for better UX
            setTimeout(() => {
                if (appId === 'minesweeper') this.openMinesweeper();
                else if (appId === 'skifree') this.openSkiFree();
                else if (appId === 'solitaire') this.openSolitaire();
                else if (appId === 'doom') this.openDoom();
                else if (appId === 'readme') this.openReadme();
                else if (appId === 'clock') {
                    const clockWindow = document.getElementById('desktop-clock');
                    if (clockWindow) {
                        clockWindow.style.display = 'flex';
                        this.focusWindow(clockWindow);
                    }
                } else if (appId.startsWith('accessory-')) {
                    const appName = appId.replace('accessory-', '');
                    this.openAccessory(appName);
                }
            }, startupPrograms.indexOf(appId) * 300);
        });
    }

    addToStartup(appId) {
        let startupPrograms = JSON.parse(localStorage.getItem('startupPrograms') || '[]');
        if (!startupPrograms.includes(appId)) {
            startupPrograms.push(appId);
            localStorage.setItem('startupPrograms', JSON.stringify(startupPrograms));
            this.updateStartupWindow();
        }
    }

    removeFromStartup(appId) {
        let startupPrograms = JSON.parse(localStorage.getItem('startupPrograms') || '[]');
        startupPrograms = startupPrograms.filter(id => id !== appId);
        localStorage.setItem('startupPrograms', JSON.stringify(startupPrograms));
        this.updateStartupWindow();
    }

    isInStartup(appId) {
        const startupPrograms = JSON.parse(localStorage.getItem('startupPrograms') || '[]');
        return startupPrograms.includes(appId);
    }

    updateStartupWindow() {
        const startupContent = document.getElementById('startup-content');
        if (!startupContent) return;
        
        const startupPrograms = JSON.parse(localStorage.getItem('startupPrograms') || '[]');
        startupContent.innerHTML = '';
        
        const appIcons = {
            'minesweeper': { icon: 'minesweeper-icon', label: 'Minesweeper' },
            'skifree': { icon: 'skifree-icon', label: 'SkiFree' },
            'solitaire': { icon: 'solitaire-icon', label: 'Solitaire' },
            'doom': { icon: 'doom-icon', label: 'Doom' },
            'readme': { icon: 'readme-icon', label: 'Read Me' },
            'clock': { icon: 'clock-icon', label: 'Clock' },
            'write': { icon: 'write-icon', label: 'Write' },
            'paintbrush': { icon: 'paintbrush-icon', label: 'Paintbrush' },
            'notepad': { icon: 'notepad-icon', label: 'Notepad' },
            'calculator': { icon: 'calculator-icon', label: 'Calculator' },
            'calendar': { icon: 'calendar-icon', label: 'Calendar' },
            'terminal': { icon: 'terminal-icon', label: 'Terminal' }
        };
        
        startupPrograms.forEach(appId => {
            let app;
            if (appId.startsWith('accessory-')) {
                const appName = appId.replace('accessory-', '');
                const accessoryIcons = {
                    'write': { icon: 'write-icon', label: 'Write' },
                    'paintbrush': { icon: 'paintbrush-icon', label: 'Paintbrush' },
                    'notepad': { icon: 'notepad-icon', label: 'Notepad' },
                    'calculator': { icon: 'calculator-icon', label: 'Calculator' },
                    'calendar': { icon: 'calendar-icon', label: 'Calendar' },
                    'terminal': { icon: 'terminal-icon', label: 'Terminal' },
                    'character-map': { icon: 'charmap-icon', label: 'Character Map' },
                    'media-player': { icon: 'mediaplayer-icon', label: 'Media Player' },
                    'sound-recorder': { icon: 'soundrec-icon', label: 'Sound Recorder' },
                    'cardfile': { icon: 'cardfile-icon', label: 'Cardfile' },
                    'recorder': { icon: 'recorder-icon', label: 'Recorder' },
                    'object-packager': { icon: 'packager-icon', label: 'Object Packager' }
                };
                app = accessoryIcons[appName] || { icon: 'mini-window-icon', label: appName };
            } else {
                app = appIcons[appId] || { icon: 'mini-window-icon', label: appId };
            }
            
            const icon = document.createElement('div');
            icon.className = 'program-icon';
            icon.dataset.app = appId;
            icon.innerHTML = `
                <div class="app-icon ${app.icon}"></div>
                <div class="program-icon-label">${app.label}</div>
            `;
            
            // Double-click to remove from startup
            icon.addEventListener('dblclick', () => {
                this.removeFromStartup(appId);
            });
            
            // Right-click to remove
            icon.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.removeFromStartup(appId);
            });
            
            startupContent.appendChild(icon);
        });
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
        let startX, startY, initialLeft, initialTop, offsetX, offsetY;

        titlebar.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons or system menu
            if (e.target.classList.contains('window-btn') || 
                e.target.closest('.window-btn') ||
                e.target.classList.contains('system-menu') ||
                e.target.closest('.system-menu')) {
                return;
            }
            isDragging = true;
            
            // Calculate offset from mouse position to window's top-left corner
            const rect = win.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            // Get the parent container for positioning
            let parentContainer;
            if (win.classList.contains('mdi-child')) {
                parentContainer = win.closest('.program-manager-content');
            } else {
                // Standalone windows are positioned relative to .retro-desktop
                parentContainer = win.closest('.retro-desktop') || document.querySelector('.retro-desktop');
            }
            
            if (parentContainer) {
                const parentRect = parentContainer.getBoundingClientRect();
                // Calculate initial position relative to parent
                initialLeft = rect.left - parentRect.left;
                initialTop = rect.top - parentRect.top;
            } else {
                // Fallback to current style values
                initialLeft = parseFloat(win.style.left) || 0;
                initialTop = parseFloat(win.style.top) || 0;
            }
            
            this.focusWindow(win);
            e.preventDefault();
        });

        const mousemoveHandler = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            // Get the parent container for positioning
            let parentContainer;
            if (win.classList.contains('mdi-child')) {
                parentContainer = win.closest('.program-manager-content');
            } else {
                // Standalone windows are positioned relative to .retro-desktop
                parentContainer = win.closest('.retro-desktop') || document.querySelector('.retro-desktop');
            }
            
            if (!parentContainer) return;
            
            const parentRect = parentContainer.getBoundingClientRect();
            
            // Calculate new position: mouse position minus the offset, relative to parent
            let newLeft = e.clientX - parentRect.left - offsetX;
            let newTop = e.clientY - parentRect.top - offsetY;
            
            // Constrain to parent bounds
            const maxX = parentContainer.offsetWidth - win.offsetWidth;
            const maxY = parentContainer.offsetHeight - win.offsetHeight;
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
