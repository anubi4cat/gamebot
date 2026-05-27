export interface LineDef {
  id: string;
  name: string;
  /** Tint color for placeholder art (hex). */
  color: number;
  /** Per-level display name. Length must equal GameConfig.maxLevel. */
  levelNames: string[];
}

/**
 * 3 production lines. Placeholder names — swap freely later.
 * Each line has 13 levels; merging two same (lineId, level) gives level+1.
 */
export const LINES: LineDef[] = [
  {
    id: 'silk',
    name: '织造',
    color: 0xe6a8c4,
    levelNames: [
      '蚕茧', '生丝', '丝线', '细纱', '素绢',
      '云锦', '彩缎', '印花绢', '蜀锦', '描金锦',
      '霓裳', '凤翎裳', '九霄霞衣',
    ],
  },
  {
    id: 'food',
    name: '食材',
    color: 0xf2c14e,
    levelNames: [
      '麦穗', '面粉', '面团', '生饼', '炊饼',
      '芝麻饼', '酥糕', '桂花糕', '蜜饯糕', '八宝糕',
      '玉露糕', '琼花酥', '仙馔',
    ],
  },
  {
    id: 'wood',
    name: '木作',
    color: 0x9c7a4a,
    levelNames: [
      '原木', '木条', '木板', '榫木', '雕坯',
      '小凳', '木椅', '案几', '雕花桌', '描金柜',
      '紫檀屏', '云纹榻', '九鼎台',
    ],
  },
];

export function getLine(id: string): LineDef {
  const line = LINES.find(l => l.id === id);
  if (!line) throw new Error(`Unknown line: ${id}`);
  return line;
}

export function getPieceName(lineId: string, level: number): string {
  return getLine(lineId).levelNames[level - 1] ?? `L${level}`;
}
