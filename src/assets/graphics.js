// Procedural sprite generator — draws everything with Phaser.Graphics,
// so the game has zero image assets to ship.
export default function createGraphics(scene) {
    const g = scene.make.graphics({ add: false });

    // --- Iron Man sprite (80x60) ---
    // torso
    g.fillStyle(0xb71c1c, 1);
    g.fillRectangle(25, 15, 30, 35);
    // arc reactor (chest core)
    g.fillStyle(0x1de9b6, 1);
    g.fillCircle(40, 30, 7);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeCircle(40, 30, 7);
    // shoulders + arms
    g.fillStyle(0xb71c1c, 1);
    g.fillRectangle(5, 18, 22, 16);
    g.fillRectangle(53, 18, 22, 16);
    // fists (gold)
    g.fillStyle(0xf9a825, 1);
    g.fillCircle(14, 26, 7);
    g.fillCircle(66, 26, 7);
    // repulsor palms
    g.fillStyle(0x1de9b6, 0.9);
    g.fillCircle(8, 26, 3.5);
    g.fillCircle(72, 26, 3.5);
    // head
    g.fillStyle(0xf9a825, 1);
    g.fillEllipse(40, 8, 22, 18);
    // visor (eyes)
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(26, 5, 34, 9, 26, 13);
    g.fillTriangle(54, 5, 46, 9, 54, 13);
    // legs (boots)
    g.fillStyle(0xb71c1c, 1);
    g.fillRectangle(22, 48, 14, 14);
    g.fillRectangle(44, 48, 14, 14);
    // thruster vents
    g.fillStyle(0x1de9b6, 0.7);
    g.fillEllipse(29, 58, 6, 3);
    g.fillEllipse(51, 58, 6, 3);

    scene.textures.generate('ironman', g, 0, 0, 80, 60);
    g.clear();

    // --- light drone (40x40) ---
    g.fillStyle(0x7a7a8e, 1);
    g.fillEllipse(20, 20, 30, 22);
    g.fillStyle(0x9e9eae, 1);
    g.fillCircle(20, 20, 9);
    // "eye"
    g.fillStyle(0xff1744, 1);
    g.fillCircle(20, 20, 5);
    // propeller blades
    g.lineStyle(3, 0xaaaaae, 1);
    for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        g.lineBetween(20 + Math.cos(a) * 10, 20 + Math.sin(a) * 10,
                      20 + Math.cos(a) * 22, 20 + Math.sin(a) * 22);
    }
    scene.textures.generate('drone', g, 0, 0, 40, 40);
    g.clear();

    // --- heavy drone (50x50) ---
    g.fillStyle(0x7b1fa2, 1);
    g.fillTriangle(25, 2, 48, 38, 2, 38);
    g.fillStyle(0x9c27b0, 1);
    g.fillCircle(25, 26, 13);
    g.fillStyle(0xffab00, 1);
    g.fillCircle(25, 26, 7);
    // cannon barrel pointing left
    g.fillStyle(0x9c27b0, 1);
    g.fillRectangle(-4, 20, 14, 8);
    scene.textures.generate('heavydrone', g, 0, 0, 50, 50);
    g.clear();

    // --- repulsor bullet (16x16) ---
    g.fillStyle(0x1de9b6, 1);
    g.fillCircle(8, 8, 7);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(8, 8, 5);
    scene.textures.generate('repulsor', g, 0, 0, 16, 16);

    // --- enemy bullet (14x14) ---
    g.fillStyle(0xffab00, 1);
    g.fillCircle(7, 7, 6);
    scene.textures.generate('enemybullet', g, 0, 0, 14, 14);

    // --- unibeam flash (256x16) ---
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(29,233,182,0)');
    grad.addColorStop(0.4, 'rgba(29,233,182,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(29,233,182,0)');
    g.fillStyle(grad, 1);
    g.fillRectangle(0, 0, 256, 16);
    scene.textures.generate('beam', g, 0, 0, 256, 16);

    // --- thruster particle (8x8) ---
    g.fillStyle(0xffab00, 1);
    g.fillCircle(4, 4, 3.5);
    scene.textures.generate('particle', g, 0, 0, 8, 8);

    g.destroy();
}
