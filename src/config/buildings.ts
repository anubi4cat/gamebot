export interface BuildingDef {
  id: string;
  name: string;
  /** Cost (gem) to advance from this stage to next. Length = stages - 1. */
  stageCosts: number[];
  /** Number of repair stages including stage 0 (破败). */
  stages: number;
  /** Position on city canvas (relative 0~1). */
  x: number;
  y: number;
  /** Visual size hint (logical px). */
  w: number;
  h: number;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'gate',     name: '城门',   stages: 3, stageCosts: [5, 12],  x: 0.50, y: 0.78, w: 220, h: 140 },
  { id: 'tower',    name: '钟楼',   stages: 3, stageCosts: [8, 16],  x: 0.22, y: 0.55, w: 160, h: 220 },
  { id: 'market',   name: '集市',   stages: 3, stageCosts: [6, 14],  x: 0.74, y: 0.58, w: 200, h: 160 },
  { id: 'temple',   name: '庙宇',   stages: 3, stageCosts: [10, 20], x: 0.50, y: 0.35, w: 240, h: 180 },
  { id: 'bridge',   name: '石桥',   stages: 2, stageCosts: [4],      x: 0.30, y: 0.88, w: 180, h: 90  },
];
