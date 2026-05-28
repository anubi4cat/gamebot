import Phaser from 'phaser';

/**
 * Crossfade between scene sets. Fades current scene's camera to a dark color,
 * stops the listed scenes, launches the target set. The launched scenes are
 * expected to call `fadeInScene` at the top of their create() so the transition
 * completes visually.
 */
export function switchScene(
  from: Phaser.Scene,
  toStop: string[],
  toLaunch: string[],
): void {
  // Fade out the cameras of all scenes we're about to stop (so Board + Hud
  // dim together rather than only the one that owns the toggle button).
  const cams: Phaser.Cameras.Scene2D.Camera[] = [];
  for (const name of toStop) {
    const s = from.scene.get(name);
    if (s && s.cameras && s.cameras.main) cams.push(s.cameras.main);
  }
  if (cams.length === 0) return;
  if (cams.some(c => c.fadeEffect.isRunning)) return;
  for (const c of cams) c.fadeOut(180, 18, 23, 32);
  from.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    for (const s of toStop) from.scene.stop(s);
    for (const s of toLaunch) from.scene.launch(s);
  });
}

/** Mirror to switchScene — call inside a scene's create() to fade in. */
export function fadeInScene(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(180, 18, 23, 32);
}
