import { GameConfig } from '../config/gameConfig';
import { BUILDINGS } from '../config/buildings';
import { LINES } from '../config/lines';
import { NPCS, TaskInstance, rollTask } from '../config/tasks';

export interface PieceData {
  id: number;
  lineId: string;
  level: number;
  /** Board coordinates (col, row). */
  col: number;
  row: number;
}

export interface ToolData {
  id: number;
  lineId: string;
  col: number;
  row: number;
}

export interface BuildingState {
  id: string;
  stage: number;
}

export interface SaveData {
  stamina: number;
  staminaUpdatedAt: number;
  coin: number;
  gem: number;
  pieces: PieceData[];
  tools: ToolData[];
  taskQueue: Record<string, TaskInstance>;
  buildings: BuildingState[];
  nextPieceId: number;
  nextToolId: number;
}

type Listener = () => void;

class GameStateClass {
  private data!: SaveData;
  private listeners = new Set<Listener>();

  init(): void {
    const loaded = this.load();
    if (loaded) {
      this.data = this.migrate(loaded);
      this.tickStaminaRegen();
    } else {
      this.data = this.makeFreshSave();
      this.save();
    }
  }

  /** Patch older saves up to current shape. Safe to run on fresh saves too. */
  private migrate(raw: SaveData): SaveData {
    if (!raw.tools) {
      raw.tools = defaultTools();
      raw.nextToolId = raw.tools.length + 1;
    }
    if (raw.nextToolId === undefined) raw.nextToolId = (raw.tools?.length ?? 0) + 1;
    return raw;
  }

  /* ---------- read ---------- */

  get stamina(): number { return this.data.stamina; }
  get coin(): number { return this.data.coin; }
  get gem(): number { return this.data.gem; }
  get pieces(): readonly PieceData[] { return this.data.pieces; }
  get tools(): readonly ToolData[] { return this.data.tools; }
  get buildings(): readonly BuildingState[] { return this.data.buildings; }
  get taskQueue(): Record<string, TaskInstance> { return this.data.taskQueue; }

  pieceAt(col: number, row: number): PieceData | undefined {
    return this.data.pieces.find(p => p.col === col && p.row === row);
  }

  toolAt(col: number, row: number): ToolData | undefined {
    return this.data.tools.find(t => t.col === col && t.row === row);
  }

  isCellOccupied(col: number, row: number): boolean {
    return !!this.pieceAt(col, row) || !!this.toolAt(col, row);
  }

  pieceById(id: number): PieceData | undefined {
    return this.data.pieces.find(p => p.id === id);
  }

  toolById(id: number): ToolData | undefined {
    return this.data.tools.find(t => t.id === id);
  }

  /** All board cells with no piece and no tool. */
  emptyCells(): Array<{ col: number; row: number }> {
    const { cols, rows } = GameConfig.board;
    const out: Array<{ col: number; row: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!this.isCellOccupied(c, r)) out.push({ col: c, row: r });
      }
    }
    return out;
  }

  buildingStage(id: string): number {
    return this.data.buildings.find(b => b.id === id)?.stage ?? 0;
  }

  /* ---------- mutations ---------- */

  spawnPiece(col: number, row: number, lineId: string, level = 1): PieceData | null {
    if (this.isCellOccupied(col, row)) return null;
    if (this.data.stamina < GameConfig.stamina.costPerSpawn) return null;
    this.data.stamina -= GameConfig.stamina.costPerSpawn;
    this.data.staminaUpdatedAt = Date.now();
    const piece: PieceData = {
      id: this.data.nextPieceId++,
      lineId, level, col, row,
    };
    this.data.pieces.push(piece);
    this.persistAndNotify();
    return piece;
  }

  /**
   * Trigger a production tool. Picks a random empty cell, debits stamina,
   * and creates the level-1 piece there. Returns the destination & piece, or
   * a reason code: 'no-stamina' | 'board-full'.
   */
  triggerTool(toolId: number): { piece: PieceData; from: { col: number; row: number } } | 'no-stamina' | 'board-full' {
    const tool = this.toolById(toolId);
    if (!tool) return 'board-full';
    if (this.data.stamina < GameConfig.stamina.costPerSpawn) return 'no-stamina';
    const empties = this.emptyCells();
    if (empties.length === 0) return 'board-full';
    const target = empties[Math.floor(Math.random() * empties.length)];
    this.data.stamina -= GameConfig.stamina.costPerSpawn;
    this.data.staminaUpdatedAt = Date.now();
    const piece: PieceData = {
      id: this.data.nextPieceId++,
      lineId: tool.lineId,
      level: 1,
      col: target.col,
      row: target.row,
    };
    this.data.pieces.push(piece);
    this.persistAndNotify();
    return { piece, from: { col: tool.col, row: tool.row } };
  }

  /** Move a tool to an empty cell. Tools never merge. */
  moveTool(toolId: number, toCol: number, toRow: number): boolean {
    const tool = this.toolById(toolId);
    if (!tool) return false;
    if (tool.col === toCol && tool.row === toRow) return false;
    if (this.isCellOccupied(toCol, toRow)) return false;
    tool.col = toCol;
    tool.row = toRow;
    this.persistAndNotify();
    return true;
  }

  /**
   * Move a piece. If the destination has a same-(line,level) piece, merge them:
   * the source piece is consumed and the destination is promoted by one level.
   * Returns the surviving piece, or null if move was rejected.
   */
  moveOrMerge(pieceId: number, toCol: number, toRow: number): PieceData | null {
    const src = this.pieceById(pieceId);
    if (!src) return null;
    if (src.col === toCol && src.row === toRow) return src;
    if (this.toolAt(toCol, toRow)) return null;

    const dst = this.pieceAt(toCol, toRow);
    if (!dst) {
      src.col = toCol;
      src.row = toRow;
      this.persistAndNotify();
      return src;
    }
    if (dst.lineId === src.lineId && dst.level === src.level && dst.level < GameConfig.maxLevel) {
      dst.level += 1;
      this.data.pieces = this.data.pieces.filter(p => p.id !== src.id);
      this.persistAndNotify();
      return dst;
    }
    return null;
  }

  /** Try to consume `count` pieces of (lineId, level). Returns true if successful. */
  consumePieces(lineId: string, level: number, count: number): boolean {
    const matches = this.data.pieces.filter(p => p.lineId === lineId && p.level === level);
    if (matches.length < count) return false;
    const ids = new Set(matches.slice(0, count).map(p => p.id));
    this.data.pieces = this.data.pieces.filter(p => !ids.has(p.id));
    this.persistAndNotify();
    return true;
  }

  submitTask(slotKey: string): boolean {
    const task = this.data.taskQueue[slotKey];
    if (!task) return false;
    if (!this.consumePieces(task.lineId, task.level, task.count)) return false;
    this.data.coin += task.reward.coin;
    this.data.gem += task.reward.gem;
    this.data.taskQueue[slotKey] = rollTask(slotKey);
    this.persistAndNotify();
    return true;
  }

  /** Repair a building one stage. Returns true if upgraded. */
  repairBuilding(id: string): boolean {
    const b = this.data.buildings.find(x => x.id === id);
    const def = BUILDINGS.find(x => x.id === id);
    if (!b || !def) return false;
    if (b.stage >= def.stages - 1) return false;
    const cost = def.stageCosts[b.stage];
    if (this.data.gem < cost) return false;
    this.data.gem -= cost;
    b.stage += 1;
    this.persistAndNotify();
    return true;
  }

  /* ---------- stamina regen ---------- */

  tickStaminaRegen(): void {
    const { max, regenIntervalMs, regenPerTick } = GameConfig.stamina;
    if (this.data.stamina >= max) {
      this.data.staminaUpdatedAt = Date.now();
      return;
    }
    const elapsed = Date.now() - this.data.staminaUpdatedAt;
    const ticks = Math.floor(elapsed / regenIntervalMs);
    if (ticks <= 0) return;
    const gained = Math.min(ticks * regenPerTick, max - this.data.stamina);
    this.data.stamina += gained;
    this.data.staminaUpdatedAt += ticks * regenIntervalMs;
    if (gained > 0) this.persistAndNotify();
  }

  millisToNextStamina(): number {
    if (this.data.stamina >= GameConfig.stamina.max) return 0;
    const elapsed = Date.now() - this.data.staminaUpdatedAt;
    return Math.max(0, GameConfig.stamina.regenIntervalMs - (elapsed % GameConfig.stamina.regenIntervalMs));
  }

  /* ---------- listeners ---------- */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  /* ---------- persistence ---------- */

  private persistAndNotify(): void {
    this.save();
    this.notify();
  }

  private save(): void {
    try {
      localStorage.setItem(GameConfig.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  private load(): SaveData | null {
    try {
      const raw = localStorage.getItem(GameConfig.storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as SaveData;
    } catch {
      return null;
    }
  }

  resetForDebug(): void {
    localStorage.removeItem(GameConfig.storageKey);
    this.data = this.makeFreshSave();
    this.save();
    this.notify();
  }

  private makeFreshSave(): SaveData {
    const taskQueue: Record<string, TaskInstance> = {};
    for (const npc of NPCS) taskQueue[npc.id] = rollTask(npc.id);
    const tools = defaultTools();
    return {
      stamina: GameConfig.stamina.max,
      staminaUpdatedAt: Date.now(),
      coin: 0,
      gem: 0,
      pieces: [],
      tools,
      taskQueue,
      buildings: BUILDINGS.map(b => ({ id: b.id, stage: 0 })),
      nextPieceId: 1,
      nextToolId: tools.length + 1,
    };
  }
}

/** Default production tool placements: bottom row of board, one per line. */
function defaultTools(): ToolData[] {
  const { cols, rows } = GameConfig.board;
  const lastRow = rows - 1;
  // Spread evenly across bottom row.
  const positions = LINES.map((_, idx) => {
    const col = Math.round((idx + 1) * (cols - 1) / (LINES.length + 1));
    return col;
  });
  return LINES.map((line, idx) => ({
    id: idx + 1,
    lineId: line.id,
    col: positions[idx],
    row: lastRow,
  }));
}

export const GameState = new GameStateClass();
