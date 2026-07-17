import {
    PLAYER_SPEED,
    PLAYER_HP,
    REPEL_COOLDOWN,
    UNIBEAM_COOLDOWN,
    UNIBEAM_DMG,
    DRONE_INTERVAL,
    STAR_COUNT,
    BUILDING_COUNT,
} from '../constants.js';
import createGraphics from '../assets/graphics.js';

export default class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
    }

    // --------------------------------------------------------
    // 1. asset generation — procedural graphics, no images
    // --------------------------------------------------------
    createGraphics() {
        createGraphics(this);
    }

    // --------------------------------------------------------
    // 2. scene setup
    // --------------------------------------------------------
    create() {
        this.createGraphics();

        // player state
        this.playerHP = PLAYER_HP;
        this.score = 0;
        this.dead = false;
        this.lastRepelTime = 0;
        this.lastBeamTime = 0;
        this.beamActive = false;
        this.beamTimer = 0;

        // --- input ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');

        // --- player sprite ---
        this.player = this.physics.add.sprite(120, 300, 'ironman');
        this.player.setCollideWorldBounds(true);

        // --- thruster particles ---
        this.emitter = this.add.particles(0, 0, 'particle', {
            x: { min: -5, max: 5 },
            y: 32,
            lifespan: 180,
            speedY: { min: 80, max: 160 },
            speedX: { min: -12, max: 12 },
            scale: { start: 1.2, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tintRange: true,
            tint: [0xffab00, 0xff6f00, 0xffd740],
            emitting: true,
            frequency: 25,
            blendMode: 'ADD',
        });
        this.emitter.start(true);

        // --- physics groups (pooled bullets) ---
        this.repulsors = this.physics.add.group({
            classType: Phaser.GameObjects.Sprite,
            createCallback: (obj) => obj.setTexture('repulsor'),
            maxSize: 40,
            runChildConfig: { active: false, visible: false },
        });

        this.enemyBullets = this.physics.add.group({
            classType: Phaser.GameObjects.Sprite,
            createCallback: (obj) => obj.setTexture('enemybullet'),
            maxSize: 30,
            runChildConfig: { active: false, visible: false },
        });

        this.enemies = this.physics.add.group({
            runChildConfig: { hp: 1, dmg: 10, type: 'drone' },
        });

        // --- parallax background ---
        this.createParallax();

        // --- HUD ---
        this.createHUD();

        // --- colliders ---
        this.physics.add.collider(this.repulsors, this.enemies, this.onRepelHit, null, this);
        this.physics.add.collider(this.enemyBullets, this.player, this.onPlayerShot, null, this);
        this.physics.add.collider(this.enemies, this.player, this.onEnemyRam, null, this);

        // --- timers ---
        this.time.addEvent({
            delay: DRONE_INTERVAL,
            callback: this.spawnDrone,
            callbackScope: this,
            loop: true,
        });

        // --- beam sweep timer (damage applied over the 0.35s flash) ---
        this.beamSweepTimer = null;

        // --- off-screen killer for pooled bullets ---
        this.repulsors.setChildConfig({ killOnExit: true });
        this.enemyBullets.setChildConfig({ killOnExit: true });

        // enemy death handling via event (no collider)
        this.enemies.on('death', (enemy) => {
            this.score += enemy.getData('type') === 'heavy' ? 30 : 10;
            this.scoreText.setText('SCORE: ' + this.score);
            this.killEnemyVisual(enemy);
        });

        // --- music (procedural background drone) ---
        import('../audio/bgm.js').then((mod) => mod.startBGM());
    }

    // --------------------------------------------------------
    // 3. parallax stars + city skyline
    // --------------------------------------------------------
    createParallax() {
        this.list = [];

        // distant stars, two layers of different speeds
        for (let i = 0; i < STAR_COUNT; i++) {
            const star = this.add.rectangle(
                Phaser.Math.Between(0, 800),
                Phaser.Math.Between(0, 600),
                Phaser.Math.Between(1, 3),
                Phaser.Math.Between(1, 3),
                0xffffff,
                Phaser.Math.FloatBetween(0.25, 0.7),
            );
            star.speed = Phaser.Math.FloatBetween(0.4, 1.4);
            star.layer = Math.random() < 0.5 ? 0 : 1;
            this.list.push(star);
        }

        // city skyline silhouettes
        for (let i = 0; i < BUILDING_COUNT; i++) {
            const w = Phaser.Math.Between(30, 80);
            const h = Phaser.Math.Between(60, 220);
            const bldg = this.add.rectangle(
                Phaser.Math.Between(0, 900),
                600 - h / 2,
                w,
                h,
                0x141428,
                0.6,
            );
            bldg.speed = 1.2;
            bldg.layer = 1;
            this.list.push(bldg);
            // window lights
            const rows = Math.floor(h / 22);
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.4) continue;
                const win = this.add.rectangle(
                    bldg.x + Phaser.Math.Between(6, w - 8),
                    600 - h + 10 + r * 22,
                    5,
                    7,
                    0xffab00,
                    0.35,
                );
                win.speed = 1.2;
                win.layer = 1;
                this.list.push(win);
            }
        }
    }

    // --------------------------------------------------------
    // 4. HUD
    // --------------------------------------------------------
    createHUD() {
        const styleBig = { font: 'bold 22px monospace', fill: '#e0e0e0' };
        const styleSm = { font: '16px monospace', fill: '#b0b0b0' };

        this.hpText = this.add.text(20, 14, 'HP: 100', styleBig).setScrollFactor(0);
        this.scoreText = this.add.text(20, 42, 'SCORE: 0', styleBig).setScrollFactor(0);
        this.beamText = this.add.text(20, 70, 'UNIBEAM: READY', { ...styleSm, fill: '#1de9b6' }).setScrollFactor(0);

        // HP bar background + fill
        this.hpBarBg = this.add.rectangle(200, 24, 200, 14, 0x333344, 0.7).setScrollFactor(0);
        this.hpBar = this.add.rectangle(200, 24, 200, 14, 0x1de9b6, 0.9).setScrollFactor(0);

        // game over overlay (hidden)
        this.goContainer = this.add.container(400, 300).setVisible(false).setScrollFactor(0);
        this.goBg = this.add.rectangle(0, 0, 520, 260, 0x000000, 0.82);
        this.goText = this.add.text(0, -50, 'GAME OVER', { font: 'bold 48px monospace', fill: '#ff1744' });
        this.goScore = this.add.text(0, 10, 'Final Score: 0', { font: '24px monospace', fill: '#e0e0e0' });
        this.restartBtn = this.add.text(0, 60, '[ RESTART ]', { font: 'bold 22px monospace', fill: '#1de9b6' })
            .setInteractive({ useHandCursor: true });
        this.restartBtn.on('pointerdown', () => this.scene.restart());
        this.goContainer.add([this.goBg, this.goText, this.goScore, this.restartBtn]);
    }

    // --------------------------------------------------------
    // 5. enemies
    // --------------------------------------------------------
    spawnDrone() {
        if (this.dead) return;
        const heavy = Math.random() < 0.3;
        const key = heavy ? 'heavydrone' : 'drone';
        const y = Phaser.Math.Between(60, 520);

        const drone = this.enemies.create(840, y, key);
        drone.hp = heavy ? 3 : 1;
        drone.dmg = 10;
        drone.type = heavy ? 'heavy' : 'drone';
        drone.setVelocityX(heavy ? -90 : -150);

        if (heavy) {
            drone.fireTimer = this.time.delayedCall(
                Phaser.Math.Between(800, 2200),
                () => this.heavyShoot(drone),
                null,
                drone,
            );
        }
    }

    heavyShoot(drone) {
        if (!drone.active || !drone.alive) return;
        const bullet = this.enemyBullets.get(drone.x - 10, drone.y);
        if (bullet) {
            bullet.body.enable = true;
            bullet.setActive(true).setVisible(true);
            bullet.setVelocity(-420, 0);
        }
        drone.fireTimer = this.time.delayedCall(2000, () => this.heavyShoot(drone), null, drone);
    }

    killEnemyVisual(enemy) {
        // small explosion particles
        const burst = this.add.particles(enemy.x, enemy.y, 'particle', {
            speed: { min: 60, max: 160 },
            lifespan: 400,
            quantity: 10,
            scale: { start: 1.4, end: 0 },
            tint: enemy.type === 'heavy' ? 0x9c27b0 : 0xaaaaae,
            emitting: false,
            blendMode: 'ADD',
        });
        burst.explode();
        this.time.delayedCall(450, () => burst.destroy());
    }

    // --------------------------------------------------------
    // 6. combat
    // --------------------------------------------------------
    onRepelHit(bullet, enemy) {
        bullet.disableBody(true, true);
        enemy.hp--;
        if (enemy.hp <= 0) enemy.destroy();
    }

    onPlayerShot(bullet, player) {
        if (this.dead) return;
        this.playerHP -= 10;
        this.hitFlash();
        bullet.disableBody(true, true);
        this.updateHP();
        if (this.playerHP <= 0) this.gameOver();
    }

    onEnemyRam(enemy, player) {
        if (this.dead) return;
        this.playerHP -= 10;
        this.hitFlash();
        enemy.destroy();
        this.updateHP();
        if (this.playerHP <= 0) this.gameOver();
    }

    hitFlash() {
        this.player.setTint(0xff1744);
        this.time.delayedCall(150, () => this.player.clearTint());
    }

    updateHP() {
        const pct = Math.max(0, this.playerHP / PLAYER_HP);
        this.hpText.setText('HP: ' + Math.max(0, this.playerHP));
        this.hpBar.setSize(200 * pct, 14);
        this.hpBar.setTint(pct > 0.3 ? 0x1de9b6 : 0xff1744);
    }

    gameOver() {
        if (this.dead) return;
        this.dead = true;
        this.physics.pause();
        this.goScore.setText('Final Score: ' + this.score);
        this.goContainer.setVisible(true).setDepth(100);
    }

    // --------------------------------------------------------
    // 7. main loop
    // --------------------------------------------------------
    update(time) {
        if (this.dead) return;

        // --- player movement (arrows + WASD) ---
        let vx = 0, vy = 0;
        if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -PLAYER_SPEED;
        if (this.cursors.right.isDown || this.wasd.D.isDown) vx = PLAYER_SPEED;
        if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -PLAYER_SPEED;
        if (this.cursors.down.isDown || this.wasd.S.isDown) vy = PLAYER_SPEED;

        // normalize diagonals
        if (vx !== 0 && vy !== 0) {
            vx *= 0.7071;
            vy *= 0.7071;
        }
        this.player.setVelocity(vx, vy);

        // tilt the sprite toward movement for a flying feel
        if (Math.abs(this.player.body.velocity.y) > 30) {
            this.player.setRotation(
                Phaser.Math.Clamp(this.player.body.velocity.y * -0.0008, -0.25, 0.25),
            );
        } else {
            this.player.setRotation(0);
        }

        // --- repulsors: left click fires toward cursor ---
        if (this.input.activePointer.isDown && time > this.lastRepelTime + REPEL_COOLDOWN) {
            const b = this.repulsors.get(this.player.x + 10, this.player.y);
            if (b) {
                b.body.enable = true;
                b.setActive(true).setVisible(true);
                b.setVelocity(0);
                this.physics.moveToObject(b, this.input.activePointer, 650);
            }
            this.lastRepelTime = time;
        }

        // --- unibeam: spacebar, 5s cooldown ---
        if (
            Phaser.Input.Keyboard.JustDown(
                this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            ) &&
            time > this.lastBeamTime + UNIBEAM_COOLDOWN
        ) {
            this.lastBeamTime = time;
            this.beamActive = true;
            this.beamTimer = 0;
            this.beamSweepTimer = this.time.addEvent({
                delay: 35,
                repeat: 10,
                callback: this.sweepBeam,
                callbackScope: this,
            });
        }

        if (this.beamActive) {
            this.beamTimer += 16.67;
            if (this.beamTimer > 350) {
                this.beamActive = false;
                if (this.beamSweepTimer) {
                    this.beamSweepTimer.remove();
                    this.beamSweepTimer = null;
                }
            }
        }

        // update beam ready text
        const beamLeft = (
            Math.max(0, (this.lastBeamTime + UNIBEAM_COOLDOWN - time) / 1000)
        ).toFixed(1);
        if (this.beamActive) {
            this.beamText.setText('UNIBEAM: FIRING').setTint(0xffffff);
        } else if (time < this.lastBeamTime + UNIBEAM_COOLDOWN) {
            this.beamText.setText('UNIBEAM: COOLDOWN ' + beamLeft + 's').setTint(0xffab00);
        } else {
            this.beamText.setText('UNIBEAM: READY').setTint(0x1de9b6);
        }

        // --- parallax drift ---
        if (this.list) {
            this.list.forEach((obj) => {
                if (typeof obj.speed === 'number') {
                    obj.x -= obj.speed;
                    if (obj.x + 40 < 0) obj.x = 840;
                }
            });
        }

        // --- clean up off-screen enemies ---
        this.enemies.children.each((e) => {
            if (e.active && e.x < -60) e.destroy();
        });
    }

    sweepBeam() {
        // unibeam sweeps horizontally to the right from the player's chest
        this.enemies.children.each((enemy) => {
            if (!enemy.alive) return;
            if (Math.abs(enemy.y - this.player.y) < 30 && enemy.x > this.player.x) {
                enemy.hp -= UNIBEAM_DMG;
                enemy.setTint(0x1de9b6);
                this.time.delayedCall(120, () => enemy.clearTint(), [], enemy);
                if (enemy.hp <= 0) enemy.destroy();
            }
        });
    }
}
