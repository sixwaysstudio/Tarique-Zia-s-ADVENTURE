// ==========================================
//  JAMAT BOSS - jamat.js
//  A stronger boss than Hasina with a helicopter
// ==========================================

// ==========================================
//  JAMAT CONFIG
// ==========================================
window.jamatConfig = {
    xOffset: 350,
    yOffset: 330,
    width: 350,
    height: 350,
    hp: 5,                // Needs 5 stomps to defeat
    speed: 1.8,           // Slightly slower than Hasina
    missileInterval: 250, // Moderate gap between bomb waves
    missileWidth: 120,
    missileHeight: 120,
    missileCount: 2,      // 2 bombs per wave
    missileSpeed: 3.5,    // Moderate bomb speed
    missileSpawnY: -100,
    missileSpread: 350,   // Moderate spread
    missileDisappearY: -350,
    missileExplodeY: 350,
    hitboxScale: 0.4,
    moveAreaWidth: 1800,  // Moderate patrol area
    helicopter: {
        width: 250,
        height: 150,
        yOffset: -180,
        shootInterval: 150, // Moderate helicopter shooting
        bulletsPerWave: 3,
        bulletSpeed: 5,     // Moderate bullet speed
        bulletWidth: 40,
        bulletHeight: 20
    },
    debugSpawnKey: 'r'
};

// ==========================================
//  HELICOPTER BULLET CLASS
// ==========================================
class HelicopterBullet {
    constructor(x, y, targetX, targetY) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.width = window.jamatConfig.helicopter.bulletWidth;
        this.height = window.jamatConfig.helicopter.bulletHeight;
        this.active = true;

        // Calculate direction toward player
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = window.jamatConfig.helicopter.bulletSpeed;
        if (dist > 0) {
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        } else {
            this.vx = 0;
            this.vy = speed;
        }
    }

    update(timeScale = 1) {
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;

        // Deactivate if traveled too far from spawn (works at any world position)
        const travelDx = this.x - this.startX;
        const travelDy = this.y - this.startY;
        if (travelDx * travelDx + travelDy * travelDy > 3000 * 3000) {
            this.active = false;
        }
    }

    draw(ctx) {
        // Use bullet.png image
        if (typeof images !== 'undefined' && images.bullet) {
            ctx.save();
            const angle = Math.atan2(this.vy, this.vx);
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(angle);
            ctx.drawImage(images.bullet, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            // Fallback
            ctx.save();
            ctx.fillStyle = '#FF4500';
            const angle = Math.atan2(this.vy, this.vx);
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(angle);
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        }
    }
}

// ==========================================
//  HELICOPTER CLASS
// ==========================================
class Helicopter {
    constructor(bossX, bossY) {
        const hConf = window.jamatConfig.helicopter;
        this.width = hConf.width;
        this.height = hConf.height;
        this.x = bossX;
        this.y = bossY + hConf.yOffset;
        this.active = true;
        this.shootTimer = 0;
        this.shootInterval = hConf.shootInterval;
        this.bullets = [];

        // Helicopter hovering animation
        this.hoverOffset = 0;
        this.hoverSpeed = 0.05;

        // Propeller animation
        this.propellerAngle = 0;
    }

    update(bossX, bossY, player, timeScale = 1) {
        if (!this.active) return;

        const hConf = window.jamatConfig.helicopter;

        // Follow boss position (hover above)
        this.x = bossX + (window.jamatConfig.width - this.width) / 2;
        this.y = bossY + hConf.yOffset;

        // Hover animation
        this.hoverOffset = Math.sin(Date.now() * this.hoverSpeed) * 10;
        this.y += this.hoverOffset;

        // Propeller spin
        this.propellerAngle += 15 * timeScale;

        // Shoot at player
        this.shootTimer += timeScale;
        if (this.shootTimer > this.shootInterval) {
            this.shootTimer = 0;
            this.shootAtPlayer(player);
        }

        // Update bullets
        this.bullets.forEach(b => b.update(timeScale));
        this.bullets = this.bullets.filter(b => b.active);
    }

    shootAtPlayer(player) {
        if (!player) return;

        const bulletsPerWave = window.jamatConfig.helicopter.bulletsPerWave || 3;
        const startX = this.x + this.width / 2;
        const startY = this.y + this.height;
        const targetX = player.x + player.width / 2;
        const targetY = player.y + (CONFIG.player.yOffset || 0) + player.height / 2;

        // Shoot 3 bullets with slight spread
        for (let i = 0; i < bulletsPerWave; i++) {
            const spreadX = (i - 1) * 120; // -120, 0, +120 spread
            this.bullets.push(new HelicopterBullet(startX, startY, targetX + spreadX, targetY));
        }

        if (typeof soundManager !== 'undefined') {
            soundManager.playShotBurst(bulletsPerWave);
        }
    }

    draw(ctx) {
        if (!this.active) return;

        if (typeof images !== 'undefined' && images.helicopter) {
            ctx.drawImage(images.helicopter, this.x, this.y, this.width, this.height);
        } else {
            // Fallback: Draw a simple helicopter shape
            ctx.save();
            ctx.fillStyle = '#333';
            // Body
            ctx.fillRect(this.x + 30, this.y + 40, this.width - 60, this.height - 60);
            // Cockpit
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 30, 0, Math.PI * 2);
            ctx.fill();

            // Propeller (animated)
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 4;
            const cx = this.x + this.width / 2;
            const cy = this.y + 30;
            const propLen = 80;
            const angle = (this.propellerAngle * Math.PI) / 180;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(angle) * propLen, cy - Math.sin(angle) * 3);
            ctx.lineTo(cx + Math.cos(angle) * propLen, cy + Math.sin(angle) * 3);
            ctx.stroke();

            ctx.restore();
        }

        // Draw helicopter bullets
        this.bullets.forEach(b => b.draw(ctx));

        // Debug hitbox
        if (window.jamatConfig && window.jamatConfig.showHitboxes) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }

    checkBulletCollisions(player) {
        if (!player || player.invulnerable) return;

        this.bullets.forEach(b => {
            if (!b.active) return;

            const pScale = CONFIG.player.hitboxScale;
            const pw = player.width * pScale;
            const ph = player.height * pScale;
            const pX = player.x + (player.width - pw) / 2;
            const pY = player.y + (CONFIG.player.yOffset || 0) + (player.height - ph) / 2;

            if (b.x < pX + pw && b.x + b.width > pX && b.y < pY + ph && b.y + b.height > pY) {
                b.active = false;
                player.takeDamage();
                if (typeof soundManager !== 'undefined') soundManager.playExplosion();
                if (typeof particles !== 'undefined' && particles) {
                    for (let i = 0; i < 5; i++) {
                        particles.emit(b.x, b.y, 'orange', 5);
                    }
                }
            }
        });
    }
}

// ==========================================
//  JAMAT BOSS CLASS
// ==========================================
class Jamat {
    constructor(x, y) {
        this.x = x;
        this.width = window.jamatConfig.width;
        this.height = window.jamatConfig.height;
        this.y = y;

        // 5 HP - needs 5 stomps
        this.hp = window.jamatConfig.hp;
        this.maxHp = window.jamatConfig.hp;
        this.active = true;

        // Movement (faster than Hasina)
        this.vx = -window.jamatConfig.speed;
        this.startX = x;
        this.attackTimer = 0;
        this.attackInterval = window.jamatConfig.missileInterval;

        // Fixed movement area
        const moveArea = window.jamatConfig.moveAreaWidth;
        this.leftBound = x - moveArea / 2;
        this.rightBound = x + moveArea / 2;

        // Spawn helicopter with boss
        this.helicopter = new Helicopter(x, y);

        // Play Helicopter Sound
        if (typeof soundManager !== 'undefined') {
            soundManager.playHelicopter();
        }

        // Rage mode at low HP
        this.enraged = false;
    }

    update(player, timeScale) {
        // Move Left/Right within fixed area
        this.x += this.vx * timeScale;

        // Bounce off fixed world-space bounds
        if (this.vx < 0 && this.x < this.leftBound) {
            this.x = this.leftBound;
            this.vx = Math.abs(this.vx);
        } else if (this.vx > 0 && this.x + this.width > this.rightBound) {
            this.x = this.rightBound - this.width;
            this.vx = -Math.abs(this.vx);
        }

        // Enrage at 2 HP or below - slight speed up
        if (!this.enraged && this.hp <= 2) {
            this.enraged = true;
            this.vx = this.vx > 0 ? window.jamatConfig.speed * 1.3 : -window.jamatConfig.speed * 1.3;
            this.attackInterval = Math.floor(window.jamatConfig.missileInterval * 0.8);
            // Helicopter shoots slightly faster
            if (this.helicopter) {
                this.helicopter.shootInterval = Math.floor(window.jamatConfig.helicopter.shootInterval * 0.7);
            }
        }

        // Shoot bombs from sky
        this.attackTimer += timeScale;
        if (this.attackTimer > this.attackInterval) {
            this.attackTimer = 0;
            this.shoot();
        }

        // Update helicopter
        if (this.helicopter) {
            this.helicopter.update(this.x, this.y, player, timeScale);
        }
    }

    shoot() {
        // Spawn bombs FROM THE SKY targeting the PLAYER with random spread (like Hasina)
        if (typeof environment !== 'undefined' && environment) {
            const count = window.jamatConfig.missileCount;
            const spread = window.jamatConfig.missileSpread;
            const spawnY = window.jamatConfig.missileSpawnY;
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
        // Draw Jamat character
        if (typeof images !== 'undefined' && images.jamat) {
            ctx.drawImage(images.jamat, this.x, this.y, this.width, this.height);
        } else {
            // Fallback
            ctx.fillStyle = '#8B0000'; // Dark red
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.fillText('JAMAT', this.x + 10, this.y + this.height / 2);
        }

        // Draw HP Bar (wider because 5 HP)
        const barWidth = this.width;
        const barHeight = 12;
        const barY = this.y - 20;

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, barY, barWidth, barHeight);
        // Red background
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(this.x, barY, barWidth, barHeight);
        // Green HP fill
        ctx.fillStyle = this.enraged ? '#FF4500' : '#00FF00';
        ctx.fillRect(this.x, barY, barWidth * (this.hp / this.maxHp), barHeight);
        // Border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, barY, barWidth, barHeight);

        // HP text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.hp + '/' + this.maxHp, this.x + barWidth / 2, barY + barHeight - 1);
        ctx.textAlign = 'left';

        // Enraged indicator
        if (this.enraged) {
            ctx.fillStyle = 'red';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚡ ENRAGED ⚡', this.x + this.width / 2, barY - 8);
            ctx.textAlign = 'left';
        }

        // Draw helicopter
        if (this.helicopter) {
            this.helicopter.draw(ctx);
        }
    }

    // Check helicopter bullet collisions (called from Environment)
    checkHelicopterCollisions(player) {
        if (this.helicopter) {
            this.helicopter.checkBulletCollisions(player);
        }
    }
}

// ==========================================
//  INTEGRATION: Spawn Jamat Boss
// ==========================================

window.addEventListener('load', function () {
    if (typeof Environment === 'undefined') {
        console.error("Environment class not found! Jamat boss cannot be integrated.");
        return;
    }

    // Add spawnJamat method to Environment
    Environment.prototype.spawnJamat = function (cameraX) {
        const x = cameraX + CONFIG.canvas.width + 100;

        const h = window.jamatConfig.height;
        const yOff = window.jamatConfig.yOffset;
        const y = CONFIG.canvas.height - this.groundHeight - h + yOff;

        this.boss = new Jamat(x, y);

        // Set boss wall - player can't go past boss's patrol area
        this.bossWallX = this.boss.rightBound;

        // Show boss warning
        if (typeof bossWarning !== 'undefined') {
            bossWarning = { active: true, timer: 150, text: '⚠️ JAMAT INCOMING! ⚠️' };
        }

        // Play Boss Music
        if (typeof soundManager !== 'undefined') soundManager.playBossMusic('JAMAT');
    };

    // Patch Environment.update to add Jamat spawn checks at 100, 200, 300...
    // Hasina already spawns at 50, 150, 250... via game.js
    const _origUpdate = Environment.prototype.update;
    Environment.prototype.update = function (cameraX) {
        // Call original update (handles Hasina spawns, items, cleanup, etc.)
        _origUpdate.call(this, cameraX);

        if (gameState.state !== 'PLAYING') return;

        // --- JAMAT SPAWN CHECK ---
        // Spawn at 100, 200, 300, 400...
        const targetScore = gameState.score;
        if (targetScore >= 100 && targetScore % 100 === 0) {
            // Use a separate tracker for Jamat spawns
            if (!this._lastJamatSpawnScore) this._lastJamatSpawnScore = 0;
            if (this._lastJamatSpawnScore !== targetScore) {
                // Only spawn if no boss is already active
                if (!this.boss) {
                    this.spawnJamat(cameraX);
                    this._lastJamatSpawnScore = targetScore;
                }
            }
        }
    };

    // Patch reset to clear Jamat tracker
    const _origReset = Environment.prototype.reset;
    Environment.prototype.reset = function () {
        _origReset.call(this);
        this._lastJamatSpawnScore = 0;
    };

    // Patch checkCollisions to handle helicopter bullet collisions
    const _origCheckCollisions = Environment.prototype.checkCollisions;
    Environment.prototype.checkCollisions = function (player) {
        _origCheckCollisions.call(this, player);

        // Check helicopter bullet collisions for Jamat boss
        if (this.boss && this.boss.active && this.boss instanceof Jamat) {
            this.boss.checkHelicopterCollisions(player);
        }
    };

    // Debug key to spawn Jamat
    window.spawnJamat = () => {
        if (typeof environment !== 'undefined' && environment) {
            console.log("Forcing Jamat Spawn!");
            environment.spawnJamat(camera.x);
        }
    };

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === window.jamatConfig.debugSpawnKey) {
            window.spawnJamat();
        }
    });

});