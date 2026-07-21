// Boot entry — creates the Phaser game, registers scenes, starts the loop.
import PlayScene from './scenes/PlayScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    backgroundColor: '#0d0d1a',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY | Phaser.Scale.CENTER_VERTICALLY,
        fullScreenStyle: 'width: 100%; height: 100%; object-fit: contain; background: #0a0a14;',
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: [PlayScene],
};

window.game = new Phaser.Game(config);
// PlayScene is already registered via config.scene — adding it again with
// scene.add() creates a duplicate key and crashes boot ("Cannot add Scene
// with duplicate key: PlayScene").
// start the loop AFTER boot, otherwise scenes are still pending and nothing renders
window.game.events.on('boot', () => window.game.start());
