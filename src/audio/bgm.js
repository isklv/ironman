// Procedural background drone via WebAudio oscillators.
// Respects browser autoplay policy: starts on first click.
let audioCtx = null;

export function startBGM() {
    try {
        if (audioCtx) return; // already running
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const gain = ctx.createGain();
        gain.gain.value = 0.04;
        gain.connect(ctx.destination);

        [55, 82.5].forEach((freq) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.connect(gain);
            osc.start();
        });

        audioCtx = ctx;
        document.addEventListener('click', () => {
            if (ctx.state === 'suspended') ctx.resume();
        }, { once: true });
    } catch (e) {
        // audio is optional; fail silently
    }
}
