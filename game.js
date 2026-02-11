const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ==========================================
//  GAME CONFIGURATION
// ==========================================
const CONFIG = {
    canvas: { width: 1920, height: 1080 }, // Logical Resolution
    player: {
        width: 350,
        height: 350,
        startX: 200,
        speed: 15,          // Was 8
        acceleration: 2.5,  // Was 1.5
        friction: 0.82,     // Slightly less friction for flow
        maxSpeed: 22,       // Was 12
        jumpStrength: 42,   // Was 30
        gravity: 2.0,       // Was 1.2 - need high gravity for snappy jumps
        yOffset: 325,
        hitboxScale: 0.18 // Increased slightly for fair play
    },
    ground: { height: 700 }, // Visual height of ground
    environment: {
        cloud: {
            height: 800,   // Cloud size
            yOffset: -150,    // Move Up/Down (Negative = Up, Positive = Down)
            speedFactor: 1.0 // Parallax speed (1.0 = moves with camera, 0.5 = slower)
        },
        scrollSpeed: 0, // Dynamic scroll speed added
        baseSpeed: 10,  // Stays constant-ish in this logic, but we use player speed mostly
        trees: {
            scaleHeight: 1000,
            positions: [
                { id: 'tree1', x: 200, yOffset: 500 },
                { id: 'tree2', x: 900, yOffset: 550 },
                { id: 'tree3', x: 1600, yOffset: 500 }
            ]
        },
        activeObstacles: { // Points (Khamba)
            scaleHeight: 800,
            hitboxScale: 0.2, // increased slightly
            positions: [{ yOffset: 600 }]
        },
        enemies: {
            police: {
                width: 350,
                height: 350,
                yOffset: 350 // +4px adjustment
            },
            rab: {
                width: 350,
                height: 350,
                yOffset: 350
            },
            bullet: {
                width: 40,
                height: 20,
                speed: 15
            }
        }
    }
};

// Boss warning system
let bossWarning = { active: false, timer: 0, text: '' };

canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

// ==========================================
//  SETTINGS MANAGER (Moved to top for init)
// ==========================================

// Device Detection
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

const defaultSettings = {
    bgm: true,
    difficulty: 'NORMAL',
    volume: 50, // %
    graphics: isMobile ? 'MEDIUM' : 'HIGH',
    maxFPS: isMobile ? '60' : 'UNCAPPED'
};

let gameSettings = JSON.parse(localStorage.getItem('adventureSettings')) || defaultSettings;

function saveSettings() {
    localStorage.setItem('adventureSettings', JSON.stringify(gameSettings));
}

// Ensure defaults are set if missing from old save
if (!gameSettings.graphics) {
    gameSettings.graphics = isMobile ? 'MEDIUM' : 'HIGH';
    saveSettings();
}
if (!gameSettings.maxFPS) {
    gameSettings.maxFPS = isMobile ? '60' : 'UNCAPPED';
    saveSettings();
}

// Resize Handler
// Resize Handler
let gameScale = 1;
function handleResize() {
    // High DPI Support (Crisp text/images on mobile)
    // Graphics Setting Logic
    let dpr = window.devicePixelRatio || 1;
    if (gameSettings.graphics === 'MEDIUM') {
        dpr = Math.min(dpr, 2.0);
    } else if (gameSettings.graphics === 'LOW') {
        dpr = 1.0; // Force 1x for maximum performance
    }
    // HIGH = Uncapped (Native)

    // Physical pixels (Resolution)
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // CSS pixels (Display size) - handled by 100vw/100vh in CSS, but good to be explicit
    // canvas.style.width = window.innerWidth + 'px';
    // canvas.style.height = window.innerHeight + 'px';

    // Game Logic Scale
    // We calculate scale based on the physical height vs logical height
    gameScale = canvas.height / CONFIG.canvas.height;

    if (gameScale < 0.001) gameScale = 0.001;
}

window.addEventListener('resize', handleResize);
handleResize();

// Fullscreen Logic
const fsBtn = document.getElementById('fullscreen-btn');
if (fsBtn) {
    fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });
}

// ==========================================
//  SOUND MANAGER (Synthesized Audio)
// ==========================================
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.unlocked = false;

        // Unlock audio on first interaction
        const unlock = () => {
            if (this.unlocked) return;
            this.unlocked = true;
            this.resume();

            // "Warm up" the audio element (Fix for iOS/Mobile requiring play inside event)
            if (this.bgMusic) {
                this.bgMusic.play().then(() => {
                    // Only pause if we haven't started playing yet
                    // This prevents the warmup from cancelling the actual game start music
                    // if they happen on the same interaction.
                    if (typeof gameState !== 'undefined' && gameState.state === 'PLAYING') {
                        // Do nothing, let it play!
                    } else {
                        this.bgMusic.pause();
                        this.bgMusic.currentTime = 0;
                    }
                }).catch((e) => {
                    console.log("Audio warmup failed (harmless):", e);
                });
            }

            ['click', 'touchstart', 'keydown'].forEach(e => document.removeEventListener(e, unlock, { capture: true }));
        };
        ['click', 'touchstart', 'keydown'].forEach(e => document.addEventListener(e, unlock, { once: true, capture: true }));

        // Load custom audio
        this.gameOverSound = new Audio('sound/We Have a.mp3');
        this.gameOverSound.volume = 1.0; // Full volume

        const vol = (typeof gameSettings !== 'undefined' && gameSettings.volume !== undefined) ? gameSettings.volume / 100 : 0.3;
        const bossVol = (typeof gameSettings !== 'undefined' && gameSettings.volume !== undefined) ? gameSettings.volume / 100 : 0.5;

        this.bgMusic = new Audio('sound/awami league theme song.mp3');
        this.bgMusic.volume = vol; // Use setting
        this.bgMusic.loop = true;

        this.blastSound = new Audio('sound/blast.mp3');
        this.blastSound.volume = 0.6; // Keep blast loud

        this.bossMusic = new Audio('sound/hasina.mp3');
        this.bossMusic.volume = bossVol;
        this.bossMusic.loop = true;

        this.jamatMusic = new Audio('sound/jamat.mp3');
        this.jamatMusic.volume = Math.min(1.0, bossVol * 2.8); // 180% louder than default
        this.jamatMusic.loop = true;

        this.fcardMusic = new Audio('sound/fcard.mp3');
        this.fcardMusic.volume = Math.min(1.0, bossVol * 2.5); // Slightly quieter than Jamat
        this.fcardMusic.loop = true;

        this.shotSound = new Audio('sound/shot.mp3');
        this.shotSound.volume = 0.4;

        this.helicopterSound = new Audio('sound/helicopter.mp3');
        this.helicopterSound.volume = 0.4;
        this.helicopterSound.loop = true;

        // AUDIO POOLING (Fixes frame drops on mobile)
        this.shotPool = [];
        this.blastPool = [];
        this.poolSize = 10;
        this.initPools();
    }

    initPools() {
        for (let i = 0; i < this.poolSize; i++) {
            const s = this.shotSound.cloneNode();
            s.volume = 0.3; // Default Shot Volume
            this.shotPool.push(s);

            const b = this.blastSound.cloneNode();
            b.volume = 0.5; // Default Blast Volume
            this.blastPool.push(b);
        }
    }

    playFromPool(pool) {
        if (!this.enabled) return;
        // Find a paused sound or one that is done
        let sound = pool.find(s => s.paused || s.ended);
        // If all busy, steal the first one (oldest)
        if (!sound) {
            sound = pool[0];
            sound.currentTime = 0;
        }
        sound.play().catch(e => { }); // Ignore play errors

        // Move to end to rotate usage
        const idx = pool.indexOf(sound);
        if (idx > -1) {
            pool.push(pool.splice(idx, 1)[0]);
        }
    }

    playJump() {
        if (!this.enabled) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(150, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.1, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + 0.1);
    }

    // ... (Collect, Launch, Explosion methods remain same)

    playBossMusic(bossType = 'HASINA') {
        if (!this.enabled) return;

        // Note: We ALLOW boss music even if BGM is off, because it's a special event.
        // The user can mute volume if they want silence.


        // Stop BG Music
        if (this.bgMusic && !this.bgMusic.paused) {
            this.bgMusic.pause();
        }

        // Stop any currently playing boss music
        this.stopBossMusic(false);

        const vol = (typeof gameSettings !== 'undefined' && gameSettings.volume !== undefined) ? gameSettings.volume / 100 : 0.5;

        if (bossType === 'JAMAT' && this.fcardMusic && this.jamatMusic) {
            // Sequence: fcard.mp3 (Intro) -> jamat.mp3 (Loop)

            // Stop Jamat initially
            this.jamatMusic.pause();
            this.jamatMusic.currentTime = 0;

            // Setup FCard (Intro)
            this.fcardMusic.currentTime = 0;
            this.fcardMusic.loop = false; // Play only once
            this.fcardMusic.volume = Math.min(1.0, vol * 2.5);

            // Chain Jamat after FCard ends
            this.fcardMusic.onended = () => {
                this.jamatMusic.volume = Math.min(1.0, vol * 2.8);
                this.jamatMusic.loop = true;
                this.jamatMusic.play().catch(e => console.log("Jamat Music follow-up failed:", e));
            };

            this.fcardMusic.play().catch(e => console.log("FCard Music play failed:", e));

        } else if (bossType === 'HASINA' && this.bossMusic) {
            // Default to Hasina
            this.bossMusic.currentTime = 0;
            this.bossMusic.volume = vol;
            this.bossMusic.play().catch(e => console.log("Boss Music play failed:", e));
        }
    }

    stopBossMusic(resumeBg = true) {
        if (this.bossMusic) {
            this.bossMusic.pause();
            this.bossMusic.currentTime = 0;
        }
        if (this.jamatMusic) {
            this.jamatMusic.pause(); // Just in case
            this.jamatMusic.currentTime = 0;
        }
        if (this.fcardMusic) {
            this.fcardMusic.pause();
            this.fcardMusic.currentTime = 0;
            this.fcardMusic.onended = null; // Important: Stop the chain if boss defeated during intro
        }

        // Resume BG Music if game is active
        // Resume BG Music if game is active
        if (resumeBg && this.enabled && gameState.state === 'PLAYING') {
            this.playBgMusic();
        }
    }

    playGameOver() {
        if (!this.enabled) return;

        // Stop all music
        this.stopBgMusic();
        this.stopBgMusic();
        this.stopBossMusic(); // Ensure boss music stops
        this.stopHelicopter(); // Ensure heli sound stops

        // Stop any previous instance to restart
        this.gameOverSound.pause();
        this.gameOverSound.currentTime = 0;

        // Play the custom MP3
        this.gameOverSound.play().catch(e => console.log("Audio play failed:", e));
    }

    playBossDeath() {
        if (!this.enabled) return;
        // Victory fanfare
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(523, this.ctx.currentTime);
        o.frequency.setValueAtTime(659, this.ctx.currentTime + 0.15);
        o.frequency.setValueAtTime(784, this.ctx.currentTime + 0.3);
        g.gain.setValueAtTime(0.1, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + 0.5);
    }

    playCollect() {
        if (!this.enabled) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(400, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.1, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + 0.15);
    }

    playMissileLaunch() {
        if (!this.enabled) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        // Falling pitch for "incoming" feel
        o.frequency.setValueAtTime(800, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.5);
        g.gain.setValueAtTime(0.05, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + 0.5);
    }

    playExplosion() {
        if (!this.enabled) return;
        this.playFromPool(this.blastPool);
    }

    playShot() {
        if (!this.enabled) return;
        this.playFromPool(this.shotPool);
    }

    playShotBurst(count = 1, interval = 100) {
        if (!this.enabled) return;
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                this.playShot();
            }, i * interval);
        }
    }

    playHelicopter() {
        if (!this.enabled || !this.helicopterSound) return;
        this.helicopterSound.currentTime = 0;
        this.helicopterSound.play().catch(e => console.log("Heli play failed:", e));
    }

    stopHelicopter() {
        if (this.helicopterSound) {
            this.helicopterSound.pause();
            this.helicopterSound.currentTime = 0;
        }
    }


    playBgMusic() {
        if (!this.enabled || !this.bgMusic) return;
        // Check setting
        if (typeof gameSettings !== 'undefined' && !gameSettings.bgm) return;
        // Check if already playing
        if (this.bgMusic.paused) {
            this.bgMusic.play().then(() => {
                // Success
            }).catch(e => {
                console.log("BG Music play failed:", e);
                // Retry once after a short delay (fixes some race conditions)
                setTimeout(() => {
                    this.bgMusic.play().catch(e2 => console.log("BG Music Retry failed:", e2));
                }, 500);
            });
        }
    }

    stopBgMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0; // Reset to start
        }
    }

    // Ensure context is running (browser policy requires interaction)
    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
}


class ParticleSystem {
    constructor() {
        this.particles = [];
        this.pool = [];
        // Pre-allocate pool
        for (let i = 0; i < 50; i++) {
            this.pool.push({
                x: 0, y: 0, vx: 0, vy: 0, life: 0, color: 'white', active: false
            });
        }
    }

    emit(x, y, color = 'yellow', count = 10) {
        for (let i = 0; i < count; i++) {
            let p;
            if (this.pool.length > 0) {
                p = this.pool.pop();
            } else {
                p = { active: false }; // Grow if needed
            }

            p.active = true;
            p.x = x;
            p.y = y;
            p.vx = (Math.random() - 0.5) * 10;
            p.vy = (Math.random() - 0.5) * 10;
            p.life = 1.0;
            p.color = color;

            this.particles.push(p);
        }
    }

    update(timeScale = 1) {
        // Reverse loop to allow safe removal
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;
            p.life -= 0.02 * timeScale;

            if (p.life <= 0) {
                p.active = false;
                // Return to pool
                this.pool.push(p);
                // Fast remove from active list
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
            }
        }
    }

    draw(ctx, cameraX) {
        this.particles.forEach(p => {
            if (!p.active) return;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });
    }
}

// ==========================================
//  GAME ASSETS & STATE
// ==========================================
const assets = {
    mc: 'assets/mc.png',
    base: 'assets/base.png',
    gbg: 'assets/gbg.png', // New background ground
    cloud: 'assets/cloud.png', // New cloud asset
    khamba: 'assets/khamba.png',
    tree1: 'assets/tree 1.png',
    tree2: 'assets/tree2 .png',
    tree3: 'assets/tree 3.png',
    poster: 'assets/poster.png',
    hasina: 'assets/special/hasina.png',
    missile: 'assets/special/missile.png',
    spike: 'assets/spike.png',
    police_stand: 'assets/enemies/police stand.png',
    police_shoot: 'assets/enemies/police shoot.png',
    rab_stand: 'assets/enemies/rab stand.png',
    rab_shoot: 'assets/enemies/rab shoot.png',
    bullet: 'assets/bullet.png',
    jamat: 'assets/special/jamat.png',
    helicopter: 'assets/special/helicopter.png'
};


const images = {};

// Duplicate classes removed

const gameState = {
    state: 'START', // START, PLAYING, GAMEOVER
    score: 0,
    startTime: 0
};

// ==========================================
//  CLASSES
// ==========================================

class InputHandler {
    constructor() {
        this.kb = { right: false, left: false, up: false }; // Keyboard State
        this.gp = { right: false, left: false, up: false }; // Gamepad State
        this.gamepadThreshold = 0.5;

        // Keyboard support
        window.addEventListener('keydown', (e) => this.down(e));
        window.addEventListener('keyup', (e) => this.up(e));

        // Touch controls support
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleJumpStart();
        });

        this.setupTouchControls();
    }

    // Combined Accessor
    get keys() {
        return {
            right: this.kb.right || this.gp.right,
            left: this.kb.left || this.gp.left,
            up: this.kb.up || this.gp.up
        };
    }

    setupTouchControls() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');

        const bindBtn = (btn, key) => {
            if (!btn) return;
            const setKey = (val) => { this.kb[key] = val; if (val && key === 'up') this.handleJumpStart(); };

            btn.addEventListener('mousedown', (e) => { e.preventDefault(); setKey(true); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); setKey(false); });
            btn.addEventListener('mouseleave', () => { setKey(false); });

            btn.addEventListener('touchstart', (e) => { e.preventDefault(); setKey(true); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); setKey(false); });
        };

        bindBtn(btnLeft, 'left');
        bindBtn(btnRight, 'right');
        bindBtn(btnJump, 'up');
    }

    down(e) {
        // Prevent default scrolling for game keys (Crucial for TV/Browser)
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code) ||
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.key)) {
            e.preventDefault();
        }

        // Standard Movement
        if (['ArrowRight', 'KeyD'].includes(e.code)) this.kb.right = true;
        if (['ArrowLeft', 'KeyA'].includes(e.code)) this.kb.left = true;

        // Jump mapping: Space, Up, W... AND Enter (TV Remote 'OK' button)
        // We only map Enter to up if we are PLAYING. 
        // If GAMEOVER/START, Enter is handled by handleEnter logic separately or we merge checks.

        const isEnter = (e.code === 'Enter' || e.key === 'Enter' || e.key === 'Accept');
        const isJumpKey = (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW');

        if (isJumpKey || (isEnter && gameState.state === 'PLAYING')) {
            this.kb.up = true;
            this.handleJumpStart();
        }

        // Menu handling (Start/Restart)
        if (isEnter) {
            this.handleEnter();
        }
    }

    up(e) {
        if (['ArrowRight', 'KeyD'].includes(e.code)) this.kb.right = false;
        if (['ArrowLeft', 'KeyA'].includes(e.code)) this.kb.left = false;

        const isEnter = (e.code === 'Enter' || e.key === 'Enter' || e.key === 'Accept');
        const isJumpKey = (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW');

        if (isJumpKey || (isEnter && gameState.state === 'PLAYING')) {
            this.kb.up = false;
        }
    }

    handleJumpStart() {
        soundManager.resume();
        if (gameState.state === 'START' || gameState.state === 'GAMEOVER') {
            this.handleEnter();
        } else if (gameState.state === 'PLAYING') {
            if (player) player.jump();
        }
    }

    handleEnter() {
        soundManager.resume();
        if (gameState.state === 'START') {
            resetGame();
            gameState.state = 'PLAYING';
            soundManager.playBgMusic();
        } else if (gameState.state === 'GAMEOVER') {
            resetGame();
            gameState.state = 'PLAYING';
            soundManager.playBgMusic();
        }
    }

    pollGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let anyGp = false;

        for (const gp of gamepads) {
            if (!gp) continue;
            anyGp = true;

            const axisX = gp.axes[0];

            this.gp.right = (axisX > this.gamepadThreshold || gp.buttons[15]?.pressed);
            this.gp.left = (axisX < -this.gamepadThreshold || gp.buttons[14]?.pressed);

            if (gp.buttons[0]?.pressed || gp.buttons[1]?.pressed) {
                if (!this.gamepadJumpPressed) {
                    this.gp.up = true; // Just for state check
                    this.handleJumpStart();
                    this.gamepadJumpPressed = true;
                }
                this.gp.up = true;
            } else {
                this.gp.up = false;
                this.gamepadJumpPressed = false;
            }

            if (gp.buttons[9]?.pressed) {
                if (!this.gamepadEnterPressed) {
                    this.handleEnter();
                    this.gamepadEnterPressed = true;
                }
            } else {
                this.gamepadEnterPressed = false;
            }
        }

        if (!anyGp) {
            this.gp = { right: false, left: false, up: false };
        }
    }

    update() {
        this.pollGamepad();
    }
}

class Player {
    constructor() {
        this.reset();
        this.maxJumps = 2; // Double Jump
    }

    reset() {
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.x = CONFIG.player.startX;
        this.y = 0;
        this.vy = 0;
        this.vx = 0;
        this.onGround = false;

        // New Props
        this.jumps = 0;
        this.health = 3;
        this.invulnerable = false;
        this.blinkTimer = 0;

        // Update HUD immediately
        updateHUD();
    }

    takeDamage() {
        if (this.invulnerable) return;

        this.health--;
        updateHUD();

        if (this.health <= 0) {
            gameOver();
        } else {
            // Invulnerability
            this.invulnerable = true;
            this.blinkTimer = 0;
            // soundManager.playHurt(); // TODO: Add hurt sound if available

            // Knockback (optional)
            this.vy = -10;

            setTimeout(() => {
                this.invulnerable = false;
            }, 1500); // 1.5s Invulnerability
        }
    }

    update(input, groundHeight, timeScale = 1) {
        if (gameState.state !== 'PLAYING') return;

        // Horiz
        if (input.keys.right) this.vx += CONFIG.player.acceleration * timeScale;
        else if (input.keys.left) this.vx -= CONFIG.player.acceleration * timeScale;
        else {
            this.vx *= Math.pow(CONFIG.player.friction, timeScale);
        }

        // Cap
        if (this.vx > CONFIG.player.maxSpeed) this.vx = CONFIG.player.maxSpeed;
        if (this.vx < -CONFIG.player.maxSpeed) this.vx = -CONFIG.player.maxSpeed;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;

        this.x += this.vx * timeScale;

        // Vert
        // Jump Logic (Double Jump)
        if (input.keys.up) {
            // Only jump if we haven't consumed all jumps
            // AND we ensure we don't spam jump (handled by input handler "start" mostly, 
            // but we need to know if this is a NEW jump press)
            // The InputHandler sets input.keys.up = true. 
            // We need a "just pressed" check OR rely on InputHandler usage.
            // Current InputHandler calls 'handleJumpStart' on press.
            // We should hook into that event or check a flag.

            // Let's rely on InputHandler calling a method on Player?
            // Or change how Jump is handled. 
            // Currently: input.keys.up stays true while held? No?
            // "bindBtn... setKey(true)..." -> "mouseup... setKey(false)"
            // So it IS held.
            // Double jump requires distinct presses.
        }

        this.vy += CONFIG.player.gravity * timeScale;
        this.y += this.vy * timeScale;

        // Ground Check
        const groundY = CONFIG.canvas.height - groundHeight;
        if (this.y + this.height > groundY) {
            this.y = groundY - this.height;
            this.vy = 0;
            this.onGround = true;
            this.jumps = 0; // Reset jumps
        }

        // Invulnerability Blink
        if (this.invulnerable) {
            this.blinkTimer += timeScale;
        }
    }

    // Explicit Jump Trigger (called by InputHandler)
    jump() {
        if (this.jumps < this.maxJumps) {
            this.vy = -CONFIG.player.jumpStrength;
            this.onGround = false;
            this.jumps++;
            soundManager.playJump();
        }
    }

    draw(ctx) {
        // Blink if invulnerable
        if (this.invulnerable && Math.floor(this.blinkTimer / 5) % 2 === 0) {
            // Don't draw (Flash effect)
            return;
        }

        const visualY = this.y + (CONFIG.player.yOffset || 0);
        if (images.mc) {
            ctx.drawImage(images.mc, this.x, visualY, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, visualY, this.width, this.height);
        }
    }
}

class Bullet {
    constructor() {
        this.reset(0, 0, true);
    }

    reset(x, y, isRight) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.environment.enemies.bullet.width;
        this.height = CONFIG.environment.enemies.bullet.height;
        this.speed = CONFIG.environment.enemies.bullet.speed;
        this.vx = isRight ? this.speed : -this.speed;
        this.active = true;
    }

    update(timeScale = 1) {
        if (!this.active) return;
        this.x += this.vx * timeScale;
    }

    draw(ctx) {
        if (!this.active) return;

        // CULLING OPTIMIZATION
        const viewW = canvas.width / gameScale;
        if (this.x + this.width < camera.x || this.x > camera.x + viewW) return;

        if (images.bullet) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            if (this.vx < 0) ctx.scale(-1, 1);
            ctx.drawImage(images.bullet, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = 'orange';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Enemy {
    constructor(type, x) {
        this.type = type; // 'police' or 'rab'
        this.x = x;

        const conf = CONFIG.environment.enemies[type];
        this.width = conf.width;
        this.height = conf.height;
        this.yOffset = conf.yOffset;

        // Calculate Y to match Player's grounded visual position
        // Player Visual Y = (GroundY - PlayerHeight) + PlayerYOffset
        const groundY = CONFIG.canvas.height - CONFIG.ground.height;
        this.y = groundY - this.height + this.yOffset;

        this.state = 'STAND'; // STAND, SHOOT
        this.stateTimer = 0;
        this.hp = 1;
        this.active = true;
        this.bullets = [];

        // Random start time to desync
        this.stateTimer = Math.random() * 100;
        this.shootInterval = 150; // frames approx
    }

    update(player, timeScale = 1) {
        if (!this.active) return;

        // VISIBILITY CHECK: Only active if somewhat onscreen
        const viewW = canvas.width / gameScale;
        // Tighter bounds: Must be within 50px of the right edge to start acting.
        // Previously +100 allowed them to shoot before appearing.
        if (this.x < camera.x - 100 || this.x > camera.x + viewW + 10) {
            return;
        }

        this.stateTimer += timeScale;

        // AI: Face the player
        // If player is to the right, face right. Else face left.
        this.facingRight = player.x > this.x;

        // State Machine
        if (this.state === 'STAND') {
            // Randomized shooting interval (e.g., 80 to 150 frames)
            const shootThreshold = 80 + Math.random() * 70;

            if (this.stateTimer > shootThreshold) {
                this.state = 'SHOOT';
                this.stateTimer = 0;
                this.shoot();
            }
        } else if (this.state === 'SHOOT') {
            if (this.stateTimer > 30) { // Shoot animation duration
                this.state = 'STAND';
                this.stateTimer = 0;
            }
        }
    }

    shoot() {
        // Spawn bullets based on difficulty
        const startX = this.x + (this.facingRight ? this.width : 0);
        const startY = this.y + this.height * 0.4; // Chest height

        let bulletCount = 3; // NORMAL
        if (gameSettings.difficulty === 'EASY') bulletCount = 1;
        if (gameSettings.difficulty === 'HARD') bulletCount = 5; // Extra Challenge? Or stick to 3 but faster? Let's do 3 for consistency with request, or 5 for 'HARD'. User asked for 3.
        // Let's make HARD = 3, NORMAL = 3 (as user requested "make them fire 3"), EASY = 1.
        // Wait, user said "reduce spawn rate... make them fire 3". This implies the NEW STANDARD is 3. I should assume Easy is easier than standard.
        // Revised: EASY=1, NORMAL=3, HARD=5 (or 3 fast).

        if (gameSettings.difficulty === 'HARD') bulletCount = 3; // Keep consistent for now unless specified.

        for (let i = 0; i < bulletCount; i++) {
            const spacing = 60; // Gap between bullets
            const offset = i * spacing;
            const bx = this.facingRight ? (startX - offset) : (startX + offset);
            // Use Pool
            const b = getBullet(bx, startY, this.facingRight);
            bullets.push(b);
        }

        if (typeof soundManager !== 'undefined') {
            soundManager.playShotBurst(bulletCount);
        }
    }

    draw(ctx) {
        if (!this.active) return;

        // CULLING OPTIMIZATION
        // If off-screen, don't draw
        const viewW = canvas.width / gameScale;
        if (this.x + this.width < camera.x || this.x > camera.x + viewW) return;

        let imgKey = `${this.type}_stand`;
        if (this.state === 'SHOOT') imgKey = `${this.type}_shoot`;

        const img = images[imgKey];
        if (img) {
            ctx.save();

            // Sprite Flipping Logic
            // Assume sprites face LEFT by default (since they are enemies)
            // If facing LEFT (default), draw normal.
            // If facing RIGHT, flip.
            // visual center for flipping
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;

            ctx.translate(cx, cy);

            // If the sprite naturally faces Left (common for enemies spawning on right),
            // then we mirror if facingRight is true.
            // However, if the sprite naturally faces Right or Front, we might need adjustment.
            // Let's assume they face LEFT. So if facingRight, scale(-1, 1).
            // But wait, earlier 'facingRight = false' meant default. 
            // So if 'facingRight' is TRUE (player is to the right), and sprite is default left, we flip.
            if (this.facingRight) {
                ctx.scale(-1, 1);
            }

            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            // Fallback
            ctx.fillStyle = this.type === 'police' ? 'blue' : 'black';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// ==========================================
//  BOSS & MISSILE CLASSES
// ==========================================
class Missile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // Use config if available
        this.width = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileWidth) ? hasinaConfig.missileWidth : 30;
        this.height = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileHeight) ? hasinaConfig.missileHeight : 60;
        this.vy = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileSpeed) ? hasinaConfig.missileSpeed : 4;
        this.active = true;
    }

    update(timeScale) {
        this.y += this.vy * timeScale;

        let shouldExplode = false;

        // Disappear check
        if (typeof environment !== 'undefined' && environment) {
            const disappearOffset = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileDisappearY != null) ? hasinaConfig.missileDisappearY : 0;
            const groundY = CONFIG.canvas.height - environment.groundHeight - disappearOffset;
            if (this.y + this.height > groundY) {
                shouldExplode = true;
            }
        }
        // Safety cleanup
        if (this.y > CONFIG.canvas.height + 100) {
            shouldExplode = true;
        }

        if (shouldExplode) {
            this.active = false;
            // Explosion at missile's actual impact position
            const explodeY = this.y + this.height;
            if (typeof particles !== 'undefined' && particles) {
                for (let i = 0; i < 15; i++) {
                    particles.emit(this.x + this.width / 2, explodeY, 'orange', 8);
                    particles.emit(this.x + this.width / 2, explodeY, 'red', 5);
                }
            }
            if (typeof soundManager !== 'undefined') soundManager.playExplosion();
        }
    }

    draw(ctx) {
        if (typeof images !== 'undefined' && images.missile) {
            ctx.drawImage(images.missile, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        // Draw hitbox if debug enabled
        if (typeof hasinaConfig !== 'undefined' && hasinaConfig.showHitboxes) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Hasina {
    constructor(x, y) {
        this.x = x;
        // Use Config if available, else default
        this.width = (typeof hasinaConfig !== 'undefined') ? hasinaConfig.width : 120;
        this.height = (typeof hasinaConfig !== 'undefined') ? hasinaConfig.height : 120;
        this.y = y; // Y is passed in, but we might want to override

        // Difficulty from Config
        this.hp = (typeof hasinaConfig !== 'undefined' && hasinaConfig.hp) ? hasinaConfig.hp : 5;
        this.active = true;

        // Movement
        const speed = (typeof hasinaConfig !== 'undefined' && hasinaConfig.speed) ? hasinaConfig.speed : 4;
        this.vx = -speed; // Moving LEFT initially (into screen)
        this.startX = x;
        this.attackTimer = 0;
        this.attackInterval = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileInterval) ? hasinaConfig.missileInterval : 120;

        // Fixed movement area (world-space bounds)
        const moveArea = (typeof hasinaConfig !== 'undefined' && hasinaConfig.moveAreaWidth) ? hasinaConfig.moveAreaWidth : 2000;
        this.leftBound = x - moveArea / 2;
        this.rightBound = x + moveArea / 2;
    }

    update(player, timeScale) {
        // Move Left/Right within FIXED area
        this.x += this.vx * timeScale;

        // Bounce off fixed world-space bounds
        if (this.vx < 0 && this.x < this.leftBound) {
            this.x = this.leftBound;
            this.vx = Math.abs(this.vx);
        }
        else if (this.vx > 0 && this.x + this.width > this.rightBound) {
            this.x = this.rightBound - this.width;
            this.vx = -Math.abs(this.vx);
        }

        // Shoot Missiles
        this.attackTimer += timeScale;
        if (this.attackTimer > this.attackInterval) {
            this.attackTimer = 0;
            this.shoot();
        }
    }

    shoot() {
        // Spawn missiles FROM THE SKY targeting the PLAYER with random spread
        if (environment) {
            const count = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileCount) ? hasinaConfig.missileCount : 3;
            const spread = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileSpread) ? hasinaConfig.missileSpread : 400;
            const spawnY = (typeof hasinaConfig !== 'undefined' && hasinaConfig.missileSpawnY != null) ? hasinaConfig.missileSpawnY : -60;
            for (let i = 0; i < count; i++) {
                const randomSpread = (Math.random() - 0.5) * spread;
                const mx = player.x + player.width / 2 - 15 + randomSpread;
                const my = spawnY - (Math.random() * 100);
                environment.missiles.push(new Missile(mx, my));
            }
            if (typeof soundManager !== 'undefined') soundManager.playMissileLaunch();
        }
    }

    draw(ctx) {
        if (images.hasina) {
            ctx.drawImage(images.hasina, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'purple';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        // Draw HP Bar
        const maxHp = (typeof hasinaConfig !== 'undefined' && hasinaConfig.hp) ? hasinaConfig.hp : 3;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y - 15, this.width, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / maxHp), 10);
    }
}

class Environment {
    constructor() {
        this.groundHeight = CONFIG.ground.height;
        this.boss = null;
        this.missiles = [];
        this.lastSpawnScore = 0;
        this.reset();
    }

    reset() {
        this.trees = [];
        this.obstacles = []; // Good points
        this.enemies = [];   // Bad obstacles (Police/RAB)
        this.heartPickups = []; // Heart pickups
        this.boss = null;
        this.missiles = [];
        bullets = []; // Global bullets
        this.lastTreeX = 0;
        this.lastItemX = 500;
        this.lastHeartX = 2000; // First heart spawns after 2000px
        this.lastSpawnScore = 0;
    }

    update(cameraX) {
        if (gameState.state !== 'PLAYING') return;

        // Safety: Cap generation distance to prevent infinite loops if scale is weird
        let safeScale = gameScale || 1;
        if (safeScale < 0.01) safeScale = 0.01;

        // Generate max 4000px ahead to be safe
        let viewWidth = canvas.width / safeScale;
        if (viewWidth > 4000) viewWidth = 4000;

        const genHorizon = cameraX + viewWidth + 500;

        // --- Trees ---
        while (this.lastTreeX < genHorizon) {
            const types = ['tree1', 'tree2', 'tree3'];
            const type = types[Math.floor(Math.random() * types.length)];
            const x = this.lastTreeX + (800 + Math.random() * 800);

            let yOffset = 500;
            const cPos = CONFIG.environment.trees.positions.find(t => t.id === type);
            if (cPos) yOffset = cPos.yOffset;

            this.trees.push({ id: type, x, yOffset });
            this.lastTreeX = x;
        }

        // --- BOSS SPAWN CHECK ---
        const targetScore = gameState.score;
        // Spawn at 50, 150, 250...
        // Condition: Score >= 50 AND (Score - 50) % 100 == 0
        if (targetScore >= 50 && (targetScore - 50) % 100 === 0) {
            if (this.lastSpawnScore !== targetScore) {
                this.spawnBoss(cameraX);
                this.lastSpawnScore = targetScore;
            }
        }

        // --- Items (Coins/Khamba & Enemies) ---
        // Only spawn regular items if Boss isn't active (Focus on Boss)
        if (!this.boss) {
            while (this.lastItemX < genHorizon) {
                const gap = 800 + Math.random() * 500;
                const startX = this.lastItemX + gap;

                let enemyThreshold = 0.5;
                if (gameSettings.difficulty === 'EASY') enemyThreshold = 0.7;
                if (gameSettings.difficulty === 'HARD') enemyThreshold = 0.3;

                const isEnemy = Math.random() > enemyThreshold;

                if (isEnemy) {
                    const type = Math.random() > 0.5 ? 'police' : 'rab';
                    this.enemies.push(new Enemy(type, startX));
                    this.lastItemX = startX + 200;
                } else {
                    const count = 3 + Math.floor(Math.random() * 4);
                    const spacing = 150;
                    for (let i = 0; i < count; i++) {
                        this.obstacles.push({
                            x: startX + (i * spacing),
                            yOffset: 600,
                            width: 80,
                            active: true
                        });
                    }
                    this.lastItemX = startX + (count * spacing);
                }
            }
        }

        // --- Heart Pickups (only spawn when player has 1 HP) ---
        if (player && player.health === 1) {
            while (this.lastHeartX < genHorizon) {
                const gap = 2000 + Math.random() * 2000; // Rare spawn
                const hx = this.lastHeartX + gap;
                const groundY = CONFIG.canvas.height - this.groundHeight;
                this.heartPickups.push({
                    x: hx,
                    y: groundY - 120, // Float above ground
                    width: 60,
                    height: 60,
                    active: true
                });
                this.lastHeartX = hx;
            }
        } else {
            // Keep lastHeartX ahead so hearts spawn near player when needed
            if (this.lastHeartX < cameraX + 1000) {
                this.lastHeartX = cameraX + 1000;
            }
        }


        // Cleanup
        const cleanupThreshold = cameraX - 3000;
        this.trees = this.trees.filter(t => t.x > cleanupThreshold);
        this.obstacles = this.obstacles.filter(o => o.x > cleanupThreshold);
        this.enemies = this.enemies.filter(e => e.x > cleanupThreshold);
        this.heartPickups = this.heartPickups.filter(h => h.x > cleanupThreshold);

        // Bullet Cleanup (Pool)
        bullets.forEach(b => {
            if (b.x > cameraX + 4000 || b.x < cleanupThreshold) {
                b.active = false; // Return to pool implicitly
            }
        });
        bullets = bullets.filter(b => b.active);

        // Update Boss
        if (this.boss) {
            if (this.boss.active) {
                this.boss.update(player, 1);
            } else {
                this.boss = null;
            }
        }

        // Update Missiles
        this.missiles.forEach(m => m.update(1));
        this.missiles = this.missiles.filter(m => m.active);
    }

    spawnBoss(cameraX) {
        // Spawn OFF-SCREEN RIGHT
        const x = cameraX + CONFIG.canvas.width + 100;

        // Spawn ON GROUND using CONFIG
        // If config is 350 height, we need to subtract 350 from groundY
        let h = 120;
        let yOff = 0;
        if (typeof window.hasinaConfig !== 'undefined') {
            h = window.hasinaConfig.height;
            yOff = window.hasinaConfig.yOffset;
        }

        // y = GroundY - Height + Offset
        // GroundY = CONFIG.canvas.height - this.groundHeight
        // So:
        const y = CONFIG.canvas.height - this.groundHeight - h + yOff;

        this.boss = new Hasina(x, y);

        // Set boss wall - player can't go past boss's patrol area
        this.bossWallX = this.boss.rightBound;

        // Show boss warning
        bossWarning = { active: true, timer: 150, text: '⚠️ BOSS INCOMING! ⚠️' };

        // Play Boss Music
        if (typeof soundManager !== 'undefined') soundManager.playBossMusic();
    }

    draw(ctx, cameraX) {
        // All Y positions must use CONFIG.canvas.height (Logical 1080)
        const logicalH = CONFIG.canvas.height;

        // 0. Clouds (Drawn BEHIND everything else)
        // 0. Clouds
        if (images.cloud) {
            const cConf = (CONFIG.environment && CONFIG.environment.cloud) ? CONFIG.environment.cloud : { height: 1000, yOffset: 0, xOffset: 0, speedFactor: 1.0 };
            const cloudH = cConf.height;
            const scale = cloudH / images.cloud.height;
            const tW = images.cloud.width * scale;

            // Parallax Logic
            const paraX = cameraX * (cConf.speedFactor !== undefined ? cConf.speedFactor : 1.0);

            const startIdx = Math.floor(paraX / tW) * tW;
            const endX = paraX + (canvas.width / gameScale) + tW;

            for (let x = startIdx; x < endX; x += tW) {
                // effectiveX = x - paraX + cameraX (Standard logic to map parallax space back to world space)
                const drawX = x + (cameraX - paraX) + (cConf.xOffset || 0);
                const drawY = cConf.yOffset || 0;
                ctx.drawImage(images.cloud, drawX, drawY, tW + 1, cloudH);
            }
        }

        // 1. Ground BACKGROUND (The deep filler)
        if (images.gbg) {
            const gH = this.groundHeight;
            const scale = gH / images.gbg.height;
            const tW = images.gbg.width * scale;
            const startIdx = Math.floor(cameraX / tW) * tW;
            const endX = cameraX + (canvas.width / gameScale) + tW;
            for (let x = startIdx; x < endX; x += tW) {
                ctx.drawImage(images.gbg, x, logicalH - gH, tW + 1, gH);
            }
        }


        // 2. Bg Trees (Drawn BEHIND Base)
        const tConf = CONFIG.environment.trees;
        this.trees.forEach(t => {
            const img = images[t.id];
            if (!img) return;
            const scale = tConf.scaleHeight / img.height;
            const w = img.width * scale;
            const y = logicalH - this.groundHeight - tConf.scaleHeight + t.yOffset;
            if (t.x + w > cameraX - 500 && t.x < cameraX + (canvas.width / gameScale) + 500) {
                ctx.drawImage(img, t.x, y, w, tConf.scaleHeight);
            }
        });

        // 3. Main Ground (Base) - Drawn AFTER Trees, BEFORE Enemies
        if (images.base) {
            const gH = this.groundHeight;
            const scale = gH / images.base.height;
            const tW = images.base.width * scale;
            const startIdx = Math.floor(cameraX / tW) * tW;
            const endX = cameraX + (canvas.width / gameScale) + tW;
            for (let x = startIdx; x < endX; x += tW) {
                ctx.drawImage(images.base, x, logicalH - gH, tW + 1, gH);
            }
        }

        // 4. Good Obstacles (Khamba) - Drawn ON TOP of Base (so they aren't buried)
        const oConf = CONFIG.environment.activeObstacles;
        this.obstacles.forEach(o => {
            if (!o.active) return;
            const img = images.khamba;
            if (!img) return;
            const scale = oConf.scaleHeight / img.height;
            o.renderWidth = img.width * scale;
            o.renderHeight = oConf.scaleHeight;
            const y = logicalH - this.groundHeight - oConf.scaleHeight + o.yOffset;
            o.renderY = y;

            if (o.x + o.renderWidth > cameraX - 500 && o.x < cameraX + (canvas.width / gameScale) + 500) {
                ctx.drawImage(img, o.x, y, o.renderWidth, oConf.scaleHeight);
            }
        });

        // 5. Enemies - Drawn ON TOP of Base
        this.enemies.forEach(e => {
            e.draw(ctx);
        });

        // 6. Bullets - Drawn ON TOP of Enemies
        bullets.forEach(b => {
            b.draw(ctx);
        });

        // 7. Boss & Missiles
        if (this.boss && this.boss.active) {
            this.boss.draw(ctx);
        }
        this.missiles.forEach(m => m.draw(ctx));

        // 8. Heart Pickups
        this.heartPickups.forEach(h => {
            if (!h.active) return;
            if (h.x + h.width > cameraX - 200 && h.x < cameraX + (canvas.width / gameScale) + 200) {
                // Floating animation
                const floatY = h.y + Math.sin(Date.now() / 300 + h.x) * 8;
                ctx.font = '50px Arial';
                ctx.fillText('❤️', h.x, floatY);
            }
        });
    }

    checkCollisions(player) {
        if (gameState.state !== 'PLAYING') return;

        // Helper for AABB
        const checkOne = (p, obj, scale) => {
            const pScale = CONFIG.player.hitboxScale;
            const pw = p.width * pScale;
            const ph = p.height * pScale;
            const pX = p.x + (p.width - pw) / 2;
            const pY = p.y + (CONFIG.player.yOffset || 0) + (p.height - ph) / 2;

            // Obj
            const ow = obj.renderWidth || obj.renderW || obj.width || 50;
            const oh = obj.renderHeight || obj.renderH || obj.height || 50;
            const ox = (obj.x || obj.renderX) + ((obj.renderWidth || obj.renderW || obj.width) - ow * scale) / 2;
            const oy = (obj.renderY || obj.y) + ((obj.renderHeight || obj.renderH || obj.height) - oh * scale) / 2;

            return (pX < ox + ow * scale && pX + pw > ox && pY < oy + oh * scale && pY + ph > oy);
        };

        // Good Items
        this.obstacles.forEach(o => {
            const hitScale = CONFIG.environment.activeObstacles.hitboxScale || 0.2;
            if (o.active && checkOne(player, o, hitScale)) {
                o.active = false;
                gameState.score += 1;
                updateHUD(); // Sync Score
                soundManager.playCollect();
                particles.emit(o.x + 40, o.renderY + 400, '#FFD700', 10);
            }
        });

        // Heart Pickups
        this.heartPickups.forEach(h => {
            if (!h.active) return;
            // Simple AABB check
            const pScale = CONFIG.player.hitboxScale;
            const pw = player.width * pScale;
            const ph = player.height * pScale;
            const pX = player.x + (player.width - pw) / 2;
            const pY = player.y + (CONFIG.player.yOffset || 0) + (player.height - ph) / 2;

            if (pX < h.x + h.width && pX + pw > h.x && pY < h.y + h.height && pY + ph > h.y) {
                h.active = false;
                if (player.health < 3) {
                    player.health++;
                    updateHUD();
                    soundManager.playCollect();
                    particles.emit(h.x + h.width / 2, h.y, 'red', 15);
                }
            }
        });

        // Bad Items (Enemies)
        this.enemies.forEach(e => {
            if (e.active) {
                if (checkOne(player, e, 0.6)) {
                    // STOMP CHECK (Robust Approach):
                    const pScale = CONFIG.player.hitboxScale;
                    const pFeet = player.y + (CONFIG.player.yOffset || 0) + (player.height * pScale);
                    const eCenterY = e.y + (e.height * 0.5);

                    const prevFeet = pFeet - player.vy;

                    // Check: Falling AND came from above
                    if (player.vy > 0 && prevFeet < eCenterY) {
                        // Kill Enemy
                        e.active = false;
                        player.vy = -20; // Bounce
                        soundManager.playCollect();
                        particles.emit(e.x + e.width / 2, e.y, 'red', 15);
                    } else {
                        // Kill Player (or Damage)
                        player.takeDamage();
                    }
                }
            }
        });

        // Bullets
        bullets.forEach(b => {
            // ... (Existing)
            // Simple point check or small rect
            const bx = b.x;
            const by = b.y;
            const bw = b.width;
            const bh = b.height;

            const pScale = CONFIG.player.hitboxScale;
            const pw = player.width * pScale;
            const ph = player.height * pScale;
            const pX = player.x + (player.width - pw) / 2;
            const pY = player.y + (CONFIG.player.yOffset || 0) + (player.height - ph) / 2;

            if (bx < pX + pw && bx + bw > pX && by < pY + ph && by + bh > pY) {
                b.active = false;
                player.takeDamage();
            }
        });

        // MISSILES (Lose 1 Health)
        this.missiles.forEach(m => {
            if (!m.active) return;

            if (checkOne(player, m, 0.5)) {
                m.active = false;
                player.takeDamage(); // Lose 1 heart instead of instant death
                // Blast sound & effect on hit
                if (typeof soundManager !== 'undefined') soundManager.playExplosion();
                if (typeof particles !== 'undefined' && particles) {
                    for (let i = 0; i < 10; i++) {
                        particles.emit(m.x + m.width / 2, m.y + m.height, 'orange', 8);
                    }
                }
            }
        });

        // BOSS
        if (this.boss && this.boss.active) {
            // Use correct config based on boss type
            let bossHitboxScale = 0.7;
            let bossReward = 50;
            if (typeof Jamat !== 'undefined' && this.boss instanceof Jamat) {
                bossHitboxScale = (typeof jamatConfig !== 'undefined' && jamatConfig.hitboxScale) ? jamatConfig.hitboxScale : 0.4;
                bossReward = 100; // Jamat is worth more
            } else {
                bossHitboxScale = (typeof hasinaConfig !== 'undefined' && hasinaConfig.hitboxScale) ? hasinaConfig.hitboxScale : 0.7;
                bossReward = 50;
            }

            if (checkOne(player, this.boss, bossHitboxScale)) {
                // Simple Rule: If player is FALLING, it's a STOMP.
                // If player is NOT falling, player takes damage.
                if (player.vy > 0) {
                    // STOMP! Damage Boss
                    this.boss.hp--;
                    player.vy = -20; // Bounce
                    if (typeof particles !== 'undefined' && particles) {
                        particles.emit(this.boss.x + this.boss.width / 2, this.boss.y, 'red', 10);
                    }
                    if (typeof soundManager !== 'undefined') soundManager.playCollect();

                    if (this.boss.hp <= 0) {
                        this.boss.active = false;
                        updateHUD();
                        // Stop Boss Music & Resume BG Music
                        if (typeof soundManager !== 'undefined') {
                            soundManager.stopBossMusic();
                            soundManager.stopHelicopter(); // Stop heli sound
                            soundManager.playBossDeath();
                        }

                        // Clear all missiles on boss death
                        this.missiles = [];

                        // Clear helicopter bullets if Jamat
                        if (this.boss.helicopter) {
                            this.boss.helicopter.bullets = [];
                            this.boss.helicopter.active = false;
                        }

                        // Big celebration particles
                        if (typeof particles !== 'undefined' && particles) {
                            for (let i = 0; i < 5; i++) {
                                particles.emit(this.boss.x + this.boss.width / 2, this.boss.y, '#FF00FF', 15);
                                particles.emit(this.boss.x + this.boss.width / 2, this.boss.y, '#FFD700', 10);
                                particles.emit(this.boss.x + this.boss.width / 2, this.boss.y, '#00FF00', 8);
                            }
                        }

                        // Show boss defeated message
                        bossWarning = { active: true, timer: 120, text: '🎉 BOSS DEFEATED!' };

                        // Clear boss reference
                        this.boss = null;
                    }
                } else {
                    // Walking into boss = take damage
                    player.takeDamage();
                }
            }
        }
    }
}

// ==========================================
//  HUD & SCORE
// ==========================================
const hudCache = {
    scoreEl: null,
    highEl: null,
    healthContainer: null,
    lastScore: -1,
    lastHealth: -1
};

function updateHUD() {
    // Init Cache logic
    if (!hudCache.scoreEl) {
        hudCache.scoreEl = document.getElementById('score-display');
        hudCache.highEl = document.getElementById('highscore-display');
        hudCache.healthContainer = document.getElementById('health-container');
    }

    // Update Score (Only if changed)
    if (gameState.score !== hudCache.lastScore) {
        if (hudCache.scoreEl) hudCache.scoreEl.innerText = "Khamba Collected: " + gameState.score;
        if (hudCache.highEl) hudCache.highEl.innerText = "Highest Khamba Collected: " + (gameState.highScore || 0);
        hudCache.lastScore = gameState.score;
    }

    // Update Health (Only if changed)
    // Also, we assume player exists if we are updating HUD
    if (player && player.health !== hudCache.lastHealth) {
        if (hudCache.healthContainer) {
            hudCache.healthContainer.innerHTML = '';
            for (let i = 0; i < player.health; i++) {
                const span = document.createElement('span');
                span.className = 'heart';
                span.innerText = '❤️';
                hudCache.healthContainer.appendChild(span);
            }
        }
        hudCache.lastHealth = player.health;
    }
}

// ==========================================
//  MAIN LOGIC
// ==========================================
let input, player, environment, soundManager, particles;
let bullets = []; // Global bullets array
const camera = { x: 0, y: 0 };
let maxPlayerX = 0; // Track max distance reached

function loadAssets(cb) {
    let loaded = 0;
    const total = Object.keys(assets).length;
    for (const key in assets) {
        const img = new Image();
        img.src = assets[key];
        img.onload = () => { loaded++; if (loaded === total) cb(); };
        img.onerror = () => { loaded++; if (loaded === total) cb(); }; // Proceed even if missing

        // Runtime Asset Resizing (Crucial for Mobile Memory)
        if (key === 'poster' || key === 'mc' || key === 'gbg') {
            img.onload = () => {
                // Resize Logic
                const tempCanvas = document.createElement('canvas');
                const tCtx = tempCanvas.getContext('2d');

                // Target Max Dimensions (e.g. 1080p equivalent)
                let maxW = 1024; // Cap width
                let maxH = 1024; // Cap height

                if (key === 'poster') { maxW = 1920; maxH = 1080; }
                if (key === 'gbg') { maxW = 2048; maxH = 2048; }

                let width = img.width;
                let height = img.height;

                if (width > maxW || height > maxH) {
                    if (width > height) {
                        if (width > maxW) {
                            height *= maxW / width;
                            width = maxW;
                        }
                    } else {
                        if (height > maxH) {
                            width *= maxH / height;
                            height = maxH;
                        }
                    }

                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    tCtx.drawImage(img, 0, 0, width, height);

                    // Replace source with smaller version
                    const newImg = new Image();
                    newImg.src = tempCanvas.toDataURL('image/png');
                    newImg.onload = () => {
                        loaded++;
                        if (loaded === total) cb();
                    };
                    images[key] = newImg;
                } else {
                    loaded++;
                    if (loaded === total) cb();
                }
            };
        } else {
            img.onload = () => { loaded++; if (loaded === total) cb(); };
        }

        images[key] = img;
    }
}

// BULLET POOLING (Reduces GC Stutters)
const bulletPool = [];
function getBullet(x, y, isRight) {
    const b = bulletPool.find(b => !b.active);
    if (b) {
        b.reset(x, y, isRight);
        return b;
    } else {
        const newB = new Bullet();
        newB.reset(x, y, isRight);
        bulletPool.push(newB);
        return newB;
    }
}

function resetGame() {
    gameState.score = 0;

    // Load High Score
    const saved = localStorage.getItem('highScore');
    gameState.highScore = saved ? parseInt(saved) : 0;

    player.reset();
    environment.reset();
    camera.x = 0;
    maxPlayerX = 0; // Reset max distance

    updateHUD();
}

function gameOver() {
    gameState.state = 'GAMEOVER';
    soundManager.stopBgMusic();
    soundManager.stopBossMusic(); // Stop boss music on game over
    soundManager.playGameOver();

    // Save High Score
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('highScore', gameState.highScore);
        updateHUD();
    }
}
//...

let lastTime = 0;
let fps = 0;
let frameCount = 0;
let lastFpsTime = 0;
let lastFrameTime = 0;

function gameLoop(timestamp) {
    // 1. Throttle Frame Rate
    if (gameSettings.maxFPS && gameSettings.maxFPS !== 'UNCAPPED') {
        const targetFPS = parseInt(gameSettings.maxFPS);
        const interval = 1000 / targetFPS;
        // Tolerance of 2ms to align with VSync
        if (timestamp < lastFrameTime + interval - 2) {
            requestAnimationFrame(gameLoop);
            return;
        }
    }
    lastFrameTime = timestamp;

    if (!lastTime) lastTime = timestamp;
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Output FPS every second
    if (timestamp > lastFpsTime + 1000) {
        fps = Math.round((frameCount * 1000) / (timestamp - lastFpsTime));
        frameCount = 0;
        lastFpsTime = timestamp;
        // Optional: Log or display FPS
        // console.log("FPS:", fps);
        const fpsEl = document.getElementById('fps-display');
        if (fpsEl) fpsEl.innerText = `FPS: ${fps}`;
    }
    frameCount++;

    // Cap deltaTime to prevent huge jumps (e.g. tab switch)
    // 60fps = 16.6ms. 240fps = 4ms. 
    // If lag > 100ms, just process 100ms to avoid tunneling.
    if (deltaTime > 100) deltaTime = 100;

    // Calculate Time Scale relative to 60 FPS (16.66ms)
    // If run at 60fps, timeScale = 1.0
    // If run at 120fps, timeScale = 0.5 (move half distance, twice as often)
    const timeScale = deltaTime / (1000 / 60);

    // --- LOGIC UPDATE (Variable Step) ---
    input.update();
    player.update(input, environment.groundHeight, timeScale);
    environment.update(camera.x);

    // Update Enemies & Bullets
    environment.enemies.forEach(e => e.update(player, timeScale));
    bullets.forEach(b => b.update(timeScale));
    bullets = bullets.filter(b => b.active); // Remove inactive from active list (they stay in pool)

    environment.checkCollisions(player);
    particles.update(timeScale);

    // Camera & Movement Constraints
    if (gameState.state !== 'GAMEOVER') {
        const threshold = 500;

        // 1. Track furthest forward progress
        if (player.x > maxPlayerX) maxPlayerX = player.x;

        // 2. Determine ideal camera position
        let targetCamX = player.x - threshold;

        // 3. Constrain Camera
        if (targetCamX < 0) targetCamX = 0;
        const backtrackLimit = maxPlayerX - 2500;
        if (targetCamX < backtrackLimit) targetCamX = backtrackLimit;

        // Apply Camera
        camera.x = targetCamX;
    }

    // Player Constraint
    if (player.x < camera.x) {
        player.x = camera.x;
        if (player.vx < 0) player.vx = 0;
    }

    // Boss Wall - can't pass the boss arena until defeated
    if (environment.boss && environment.boss.active) {
        // Use boss's right patrol bound as the wall
        const wallX = environment.boss.rightBound || environment.bossWallX;
        if (wallX && player.x > wallX) {
            player.x = wallX;
            if (player.vx > 0) player.vx = 0;
        }
    } else {
        // Clear wall when boss is gone
        environment.bossWallX = null;
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scaling View
    ctx.save();
    ctx.scale(gameScale, gameScale);

    // Draw World
    ctx.save();
    ctx.translate(-camera.x, 200); // 200px offset down

    environment.draw(ctx, camera.x);
    particles.draw(ctx, camera.x);
    player.draw(ctx);

    // DEBUG: Show Hitboxes
    if (window.hasinaConfig && window.hasinaConfig.showHitboxes) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;

        // Player
        const pScale = CONFIG.player.hitboxScale;
        const pw = player.width * pScale;
        const ph = player.height * pScale;
        const px = player.x + (player.width - pw) / 2;
        const py = player.y + (CONFIG.player.yOffset || 0) + (player.height - ph) / 2;
        ctx.strokeRect(px, py, pw, ph);

        // Active Obstacles
        ctx.strokeStyle = 'blue';
        environment.obstacles.forEach(o => {
            if (o.active && o.renderWidth) {
                const scale = CONFIG.environment.activeObstacles.hitboxScale || 0.2;
                const ow = o.renderWidth * scale;
                const oh = o.renderHeight * scale;
                const ox = o.x + (o.renderWidth - ow) / 2;
                const oy = o.renderY + (o.renderHeight - oh) / 2;
                ctx.strokeRect(ox, oy, ow, oh);
            }
        });

        // Enemies
        ctx.strokeStyle = 'yellow';
        environment.enemies.forEach(e => {
            if (e.active) {
                ctx.strokeRect(e.x, e.y, e.width, e.height);
            }
        });

        // Bullets
        ctx.strokeStyle = 'red';
        bullets.forEach(b => {
            ctx.strokeRect(b.x, b.y, b.width, b.height);
        });

        // Boss
        if (environment.boss && environment.boss.active) {
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 4;
            ctx.strokeRect(environment.boss.x, environment.boss.y, environment.boss.width, environment.boss.height);
        }

        // Missile Explode Line (shows where explosions happen)
        if (window.hasinaConfig && window.hasinaConfig.missileExplodeY != null) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            const explodeY = window.hasinaConfig.missileExplodeY;
            ctx.beginPath();
            ctx.moveTo(camera.x, explodeY);
            ctx.lineTo(camera.x + CONFIG.canvas.width, explodeY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'yellow';
            ctx.font = '12px Arial';
            ctx.fillText('Explode Y: ' + explodeY, camera.x + 10, explodeY - 5);
        }
    }

    ctx.restore(); // Restore Camera
    ctx.restore(); // Restore Scale

    // Boss Warning / Defeat overlay
    if (bossWarning.active && bossWarning.timer > 0) {
        bossWarning.timer--;
        const alpha = Math.min(1, bossWarning.timer / 30);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = bossWarning.text.includes('DEFEATED') ? '#00FF00' : '#FF4444';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(bossWarning.text, canvas.width / 2, canvas.height / 3);
        ctx.fillText(bossWarning.text, canvas.width / 2, canvas.height / 3);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
        ctx.restore();
        if (bossWarning.timer <= 0) bossWarning.active = false;
    }

    // UI Layer
    drawUI();

    requestAnimationFrame(gameLoop);
}

function drawUI() {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;

    // Score
    ctx.textAlign = 'left';


    // Overlays
    if (gameState.state === 'START') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText("Tarek's Adventure", canvas.width / 2, canvas.height / 2 - 50);
        ctx.fillText("Tarek's Adventure", canvas.width / 2, canvas.height / 2 - 50);

        ctx.font = '40px Arial';
        ctx.fillText("Press ENTER or TAP to Start", canvas.width / 2, canvas.height / 2 + 50);
        ctx.font = '24px Arial';
        ctx.fillText("Arrows / WASD to Move", canvas.width / 2, canvas.height / 2 + 100);
    }
    else if (gameState.state === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; // Darker background for poster visibility
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Poster
        if (images.poster) {
            // Maintain aspect ratio or fit? Let's fit height to 60vh
            const h = canvas.height * 0.6;
            const scale = h / images.poster.height;
            const w = images.poster.width * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2 - 50; // Slightly up

            ctx.drawImage(images.poster, x, y, w, h);

            // Draw border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 5;
            ctx.strokeRect(x, y, w, h);
        }

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';

        ctx.font = 'bold 60px Arial';
        ctx.strokeText("GAME OVER", canvas.width / 2, canvas.height - 150);
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height - 150);

        ctx.font = '40px Arial';
        ctx.fillText("Khamba Collected: " + gameState.score, canvas.width / 2, canvas.height - 90);
        ctx.font = '30px Arial';
        ctx.fillText("Press ENTER to Try Again", canvas.width / 2, canvas.height - 40);
    }
}

// ==========================================
//  SETTINGS LOGIC (Definitions moved to top)
// ==========================================


const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const bgmToggle = document.getElementById('bgm-toggle');
const difficultySelect = document.getElementById('difficulty-select');

// ==========================================
//  HASINA DEBUG CONTROLS (CODE ONLY)
// ==========================================
// User can edit these values here or via console
window.hasinaConfig = {
    xOffset: 350,
    yOffset: 330,
    width: 350,
    height: 350,
    hp: 3,               // Boss HP
    speed: 2,            // Boss Movement Speed
    missileInterval: 200, // Frames between missile waves
    missileWidth: 120,   // Missile Width
    missileHeight: 120,  // Missile Height
    missileCount: 3,     // Missiles per wave
    missileSpeed: 4,     // Missile fall speed
    missileSpawnY: -100,  // Y where missiles appear
    missileSpread: 400,  // Random spread range around player (px)
    missileDisappearY: -350, // Missile disappear offset
    missileExplodeY: 350, // Y position on screen where explosion happens
    hitboxScale: 0.4,    // Hasina Hitbox Scale
    moveAreaWidth: 2000, // Patrol area width
    debugSpawnKey: '',  // Press 'h' to spawn boss
    showHitboxes: false  // Debug hitboxes OFF
};

// Global function to spawn Boss
window.spawnHasina = () => {
    if (environment) {
        console.log("Forcing Hasina Spawn!");
        environment.spawnBoss(camera.x);
    }
};

// Keyboard Debug
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === window.hasinaConfig.debugSpawnKey) {
        window.spawnHasina();
    }
});

function toggleSettings() {
    const isHidden = settingsModal.classList.contains('hidden');
    if (isHidden) {
        // OPEN
        settingsModal.classList.remove('hidden');
        if (gameState.state === 'PLAYING') {
            gameState.state = 'PAUSED';
            if (soundManager.bgMusic) soundManager.bgMusic.pause(); // Pause music when menu open
        }
    } else {
        // CLOSE
        settingsModal.classList.add('hidden');
        if (gameState.state === 'PAUSED') {
            gameState.state = 'PLAYING';
            // Resume music if enabled
            if (gameSettings.bgm && soundManager) soundManager.playBgMusic();
        }
    }
}

// Event Listeners
if (settingsBtn) settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent game click
    toggleSettings();
});

if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
});

if (bgmToggle) bgmToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    gameSettings.bgm = !gameSettings.bgm;

    // UI Update
    bgmToggle.textContent = gameSettings.bgm ? "ON" : "OFF";
    bgmToggle.className = `toggle-btn ${gameSettings.bgm ? 'on' : 'off'}`;

    // Logic Update
    if (soundManager) {
        soundManager.enabled = true; // Keep SFX? Assume yes. user said "mute bgm".
        // Actually soundManager.enabled controls EVERYTHING in current code. 
        // User asked to mute BGM.

        if (gameSettings.bgm) {
            if (gameState.state === 'PLAYING') soundManager.playBgMusic();
        } else {
            soundManager.stopBgMusic();
        }
    }
    saveSettings();
});

// Note / Mission Logic
const noteBtn = document.getElementById('note-btn');
const noteModal = document.getElementById('note-modal');
const closeNoteBtn = document.getElementById('close-note');

function toggleNote() {
    const isHidden = noteModal.classList.contains('hidden');
    if (isHidden) {
        noteModal.classList.remove('hidden');
        if (gameState.state === 'PLAYING') {
            gameState.state = 'PAUSED';
            if (soundManager.bgMusic) soundManager.bgMusic.pause();
        }
    } else {
        noteModal.classList.add('hidden');
        if (gameState.state === 'PAUSED') {
            gameState.state = 'PLAYING';
            if (gameSettings.bgm && soundManager) soundManager.playBgMusic();
        }
    }
}

if (noteBtn) noteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNote();
});

if (closeNoteBtn) closeNoteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNote();
});

if (difficultySelect) difficultySelect.addEventListener('change', (e) => {
    e.stopPropagation();
    gameSettings.difficulty = e.target.value;
    // Difficulty logic applied in Environment.update
    console.log("Difficulty set to:", gameSettings.difficulty);
    saveSettings();
});

// Volume Slider
const bgmVolume = document.getElementById('bgm-volume');
const volumeLabel = document.getElementById('volume-label');
if (bgmVolume) {
    bgmVolume.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseInt(e.target.value);
        gameSettings.volume = val;
        const vol = val / 100;

        if (volumeLabel) volumeLabel.textContent = val + '%';

        if (soundManager) {
            if (soundManager.bgMusic) soundManager.bgMusic.volume = vol;
            if (soundManager.bossMusic) soundManager.bossMusic.volume = vol;
            if (soundManager.jamatMusic) soundManager.jamatMusic.volume = Math.min(1.0, vol * 2.8); // 180% louder
        }
        saveSettings();
    });
}

// Graphics Setting
const graphicsSelect = document.getElementById('graphics-select');
if (graphicsSelect) {
    graphicsSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        gameSettings.graphics = e.target.value;
        console.log("Graphics set to:", gameSettings.graphics);
        saveSettings();
        // Apply immediately
        handleResize();
    });
}

// Max FPS Setting
const fpsSelect = document.getElementById('fps-select');
if (fpsSelect) {
    fpsSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        gameSettings.maxFPS = e.target.value;
        console.log("Max FPS set to:", gameSettings.maxFPS);
        saveSettings();
    });
}

// Initialize UI from loaded settings
if (gameSettings.bgm !== undefined && bgmToggle) {
    bgmToggle.textContent = gameSettings.bgm ? "ON" : "OFF";
    bgmToggle.className = `toggle-btn ${gameSettings.bgm ? 'on' : 'off'}`;
}
if (gameSettings.difficulty && difficultySelect) {
    difficultySelect.value = gameSettings.difficulty;
}
if (gameSettings.graphics && graphicsSelect) {
    graphicsSelect.value = gameSettings.graphics;
} else if (graphicsSelect) {
    // Default to MEDIUM (Balanced) if not set
    gameSettings.graphics = 'MEDIUM';
    graphicsSelect.value = 'MEDIUM';
}
if (gameSettings.maxFPS && fpsSelect) {
    fpsSelect.value = gameSettings.maxFPS;
} else if (fpsSelect) {
    // Default to 60 (Requested)
    gameSettings.maxFPS = '60';
    fpsSelect.value = '60';
}
if (gameSettings.volume !== undefined && bgmVolume) {
    bgmVolume.value = gameSettings.volume;
    if (volumeLabel) volumeLabel.textContent = gameSettings.volume + '%';
}


// Initialize SoundManager EARLY to catch first interaction
soundManager = new SoundManager();

// Start
loadAssets(() => {
    input = new InputHandler();
    player = new Player();
    environment = new Environment();
    // soundManager is already initialized
    particles = new ParticleSystem();
    requestAnimationFrame(gameLoop);

    // Open the door with a slight delay for dramatic effect
    setTimeout(() => {
        const door = document.getElementById('door-container');
        if (door) {
            door.classList.add('open');
            // Remove from DOM after animation completes to free resources/pointers
            setTimeout(() => {
                door.style.display = 'none';
            }, 2000); // 1.5s transition + buffer
        }
    }, 500);
});