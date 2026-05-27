export const GameConfig = {
  board: {
    cols: 7,
    rows: 9,
  },
  stamina: {
    max: 50,
    costPerSpawn: 1,
    regenIntervalMs: 60_000,
    regenPerTick: 1,
  },
  maxLevel: 13,
  taskSlots: 3,
  storageKey: 'gamebot.save.v1',
  /** Logical design resolution. Phaser will scale to fit the screen. */
  viewport: {
    width: 720,
    height: 1280,
  },
} as const;
