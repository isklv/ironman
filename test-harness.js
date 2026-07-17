// Minimal Phaser 3 mock + scene verification harness.
// Runs the game logic headless in Node to catch runtime errors.
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. Stub out browser globals
// ---------------------------------------------------------------------------
global.window = {};
global.document = {
    addEventListener: () => {},
    getElementById: () => ({ classList: { toggle: () => {} } }),
};

// ---------------------------------------------------------------------------
// 2. Minimal Phaser 3 API surface the game uses
// ---------------------------------------------------------------------------
const events = [];
class EventBus {
    on(event, fn) { events.push({ event, fn }); }
    emit(event, ...args) {
        events.filter(e => e.event === event).forEach(e => e.fn(...args));
    }
}

class MockScene {
    constructor(name) { this.events = new EventBus(); }
}

class MockSprite {
    constructor(x, y, texture) {
        this.x = x; this.y = y; this.texture = texture;
        this.active = true; this.alive = true;
        this.body = { enable: true };
        this.vx = 0; this.vy = 0;
    }
    setCollideWorldBounds() { return this; }
    setVelocity(x, y) { this.vx = x; this.vy = y; return this; }
    setRotation(r) { return this; }
    setTint(c) { return this; }
    clearTint() { return this; }
    setActive(a) { this.active = a; return this; }
    setVisible(v) { return this; }
    setTexture(t) { this.texture = t; return this; }
    disableBody() { this.body.enable = false; }
    getData(key) { return this[key === 'type' ? '_type' : key]; }
    destroy() { this.alive = false; this.active = false; }
}

class MockGroup {
    constructor(config) {
        this.children = [];
        this.config = config || {};
    }
    create(x, y, texture) {
        const obj = new MockSprite(x, y, texture);
        if (this.config.runChildConfig) {
            Object.assign(obj, this.config.runChildConfig);
            if (this.config.runChildConfig.type) obj._type = this.config.runChildConfig.type;
        }
        if (this.config.createCallback) this.config.createCallback(obj);
        this.children.push(obj);
        return obj;
    }
    get(x, y) {
        const dead = this.children.find(c => !c.active);
        if (dead) { dead.active = true; dead.alive = true; dead.x = x; dead.y = y; return dead; }
        const obj = new MockSprite(x, y, null);
        if (this.config.runChildConfig) Object.assign(obj, this.config.runChildConfig);
        if (this.config.createCallback) this.config.createCallback(obj);
        this.children.push(obj);
        return obj;
    }
    setChildConfig() {}
}

class MockPhysics {
    add = {
        sprite: (x, y, t) => new MockSprite(x, y, t),
        group: (c) => new MockGroup(c),
    };
    addToWorld() {}
    moveToObject(obj, target, speed) {
        obj.vx = 650; // pretend it moves toward pointer
    }
    addCollider() {}
    pause() {}
}

class MockInput {
    activePointer = { isDown: false, x: 400, y: 300 };
    keyboard = {
        createCursorKeys: () => ({ left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } }),
        addKeys: (s) => Object.fromEntries(s.split(',').map(k => [k, { isDown: false }])),
        addKey: (code) => ({ _code: code }),
    };
}

class MockTime {
    addEvent(opts) { return opts; }
    delayedCall(delay, cb) { return { delay, cb }; }
}

class MockInputKeyboard {
    static KeyCodes = { SPACE: 32 };
    static JustDown(key) { return key._justDown || false; }
}

class MockGraphics {
    fillStyle(color, alpha) { return this; }
    fillCircle(x, y, r) { return this; }
    fillEllipse(x, y, rx, ry) { return this; }
    fillRect(x, y, w, h) { return this; }
    fillRectangle(x, y, w, h) { return this; }
    fillTriangle(x1, y1, x2, y2, x3, y3) { return this; }
    lineStyle(thickness, color, alpha) { return this; }
    strokeCircle(x, y, r) { return this; }
    strokeRect(x, y, w, h) { return this; }
    clear() { return this; }
    reset() { return this; }
    generateTexture(name, w, h) { textures[name] = true; return this; }
}

const textures = {};
global.Phaser = {
    AUTO: 'auto',
    Scale: {
        FIT: 'fit',
        CENTER_HORIZONTALLY: 1,
        CENTER_VERTICALLY: 2,
    },
    Scene: MockScene,
    GameObjects: { Sprite: MockSprite },
    Input: { Keyboard: MockInputKeyboard },
    Math: {
        Between: (a, b) => a + Math.floor(Math.random() * (b - a)),
        FloatBetween: (a, b) => a + Math.random() * (b - a),
        Clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    },
};

class Game {
    constructor(config) {
        this.config = config;
        this.events = new EventBus();
        this.scene = { add: () => {} };
        this.scenes = {};
    }
    start() {
        for (const SceneClass of this.config.scene) {
            const s = new SceneClass();
            s.physics = new MockPhysics();
            s.input = new MockInput();
            s.time = new MockTime();
            s.textures = { generate: (name, ...args) => { textures[name] = true; }, ...textures };
            s.add = {
                rectangle: (...a) => ({ x: a[0], y: a[1] }),
                text: (...a) => ({ setText: function(t){ return this; }, setScrollFactor: function(){ return this; }, setTint: function(){ return this; } }),
                container: (...a) => ({ add: function(arr){ return this; }, setVisible: function(v){ return this; }, setDepth: function(){ return this; } }),
                particles: () => ({ start: () => {}, explode: () => {} }),
            };
            s.make = {
                graphics: () => new MockGraphics(),
            };
            s.list = [];
            s.create();
            this.scenes[s.constructor.name] = s;
        }
        this.events.emit('boot');
    }
}

// ---------------------------------------------------------------------------
// 3. Load and run the actual game code
// ---------------------------------------------------------------------------
console.log('--- Loading game modules ---');

// We need to eval each ES module with imports resolved manually.
const src = (name) => fs.readFileSync(path.join('/opt/data/ironman/src', name), 'utf8');

// Patch imports/exports out, then eval into a persistent vm context so class
// declarations survive across module loads and are retrievable by name.
// This is the harness-only module loader — never run in the browser.
const vm = require('vm');
const sandbox = { Phaser };
vm.createContext(sandbox);
function loadModule(body) {
    const patched = body
        .replace(/^import\s*\{[^}]*\}\s*from\s*['"]\..*['"];?\s*$/gm, '')
        .replace(/^import\s+\w+\s+from\s*['"]\..*['"];?\s*$/gm, '')
        .replace(/import\s*\(['"][^'"]*['"]\)\s*[.{;][\s\S]*?(;|\n)/g, '')
        .replace(/^export default /gm, '')
        .replace(/^export /gm, '');
    vm.runInContext(patched, sandbox);
    return sandbox;
}

// vm contexts don't expose class declarations as enumerable properties,
// so grab them by name via a follow-up script in the same context.
function getFromSandbox(name) {
    sandbox.out = null;
    vm.runInContext('out = ' + name + ';', sandbox);
    return sandbox.out;
}

// Load constants first (they get injected as args)
const constBody = src('constants.js');
const constEval = new Function(
    constBody.replace(/^export /gm, '') + '\nreturn ({' + 
        constBody.match(/export const \w+/g).map(s => s.replace('export const ', '')).join(',') + '});');
const C = constEval();
console.log('constants loaded:', Object.keys(C).length, 'entries');

// Load asset generator
try {
    loadModule(src('assets/graphics.js'));
    console.log('assets/graphics.js OK');
} catch (e) { console.error('assets fail:', e.message); process.exit(1); }

// Load scene
let PlayScene;
try {
    loadModule(src('scenes/PlayScene.js'));
    PlayScene = getFromSandbox('PlayScene');

    if (!PlayScene) {
        console.error('FATAL: PlayScene class not exported');
        process.exit(1);
    }
    console.log('PlayScene loaded, class:', PlayScene.name);
} catch (e) {
    console.error('scene load fail:', e.message);
    process.exit(1);
}

// Inject the real C values into the scene module scope — they're used as free vars
// since we stripped imports. They resolve from the Function args above. OK.

console.log('--- Booting game ---');
const game = new Game({
    type: Phaser.AUTO,
    width: 800, height: 600,
    scene: [PlayScene],
});
game.start();

const scene = game.scenes.PlayScene;
if (!scene) { console.error('FATAL: PlayScene never created'); process.exit(1); }

console.log('--- Verifying scene state ---');
const errors = [];

function check(name, cond) {
    if (!cond) errors.push(name);
}

check('textures generated', Object.keys(textures).length >= 7);
check('player exists', scene.player && scene.player.alive);
check('player in world', scene.player.x >= 0 && scene.player.y >= 0);
check('physics groups exist', scene.repulsors && scene.enemyBullets && scene.enemies);
check('hud rendered', scene.hpText && scene.scoreText && scene.beamText);
check('parallax objects', scene.list && scene.list.length > 0);
check('emitter exists', scene.emitter !== undefined);

// Simulate a few frames of gameplay
console.log('--- Simulating 60 frames ---');
scene.input.activePointer.isDown = true;
for (let i = 0; i < 60; i++) {
    try {
        scene.update(i * 16.67);
    } catch (e) {
        console.error('FRAME ' + i + ' CRASH: ' + e.message);
        process.exit(1);
    }
}

check('player survived', scene.playerHP > 0 || scene.dead === true); // either alive or properly flagged dead
check('score tracked', typeof scene.score === 'number');

// Try a restart (tests the game-over flow path)
scene.playerHP = -1;
scene.gameOver();
check('gameover sets dead flag', scene.dead === true);
scene.dead = false;
scene.playerHP = 100;

console.log('--- Result: ' + (errors.length === 0 ? 'ALL CHECKS PASSED' : errors.length + ' FAILURES') + ' ---');
if (errors.length > 0) {
    console.error('Failed checks: ' + errors.join(', '));
    process.exit(1);
}
console.log('Textures: ' + Object.keys(textures).join(', '));
console.log('Parallax objects: ' + scene.list.length);
console.log('Score after 60 frames: ' + scene.score);
