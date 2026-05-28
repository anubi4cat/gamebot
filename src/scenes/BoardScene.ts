import Phaser from 'phaser';
import { GameConfig } from '../config/gameConfig';
import { GameState, PieceData, ToolData } from '../state/GameState';
import { PieceView } from '../objects/Piece';
import { ToolView } from '../objects/Tool';

const BOARD_MARGIN_X = 16;
const BOARD_TOP = 220;
const BOARD_BOTTOM = 80;

/**
 * Main merge scene. Production tools live on the board; tapping one spawns
 * a Lv.1 piece into a random empty cell with a parabolic toss animation.
 * Regular pieces drag-merge with same (line, level).
 */
export class BoardScene extends Phaser.Scene {
  private cellSize = 0;
  private boardX = 0;
  private boardY = 0;
  private boardGfx!: Phaser.GameObjects.Graphics;
  private dropZones: Phaser.GameObjects.Zone[][] = [];
  private pieces = new Map<number, PieceView>();
  private toolViews = new Map<number, ToolView>();
  /** Pieces currently mid-animation; skip removing/re-adding during sync. */
  private flyingPieceIds = new Set<number>();

  constructor() { super('Board'); }

  create(): void {
    const { width, height } = this.scale.gameSize;
    const { cols, rows } = GameConfig.board;

    const availableW = width - BOARD_MARGIN_X * 2;
    const availableH = height - BOARD_TOP - BOARD_BOTTOM;
    this.cellSize = Math.floor(Math.min(availableW / cols, availableH / rows));
    const boardW = this.cellSize * cols;
    const boardH = this.cellSize * rows;
    this.boardX = (width - boardW) / 2;
    this.boardY = BOARD_TOP;

    this.boardGfx = this.add.graphics();
    this.drawBoardBackground(boardW, boardH);

    // Drop zones — for both pieces (merge) and tools (relocate).
    this.dropZones = [];
    for (let r = 0; r < rows; r++) {
      const row: Phaser.GameObjects.Zone[] = [];
      for (let c = 0; c < cols; c++) {
        const { x, y } = this.cellCenter(c, r);
        const zone = this.add.zone(x, y, this.cellSize, this.cellSize)
          .setRectangleDropZone(this.cellSize, this.cellSize);
        (zone as any).boardCol = c;
        (zone as any).boardRow = r;
        row.push(zone);
      }
      this.dropZones.push(row);
    }

    for (const t of GameState.tools) this.spawnToolView(t);
    for (const p of GameState.pieces) this.spawnPieceView(p);

    this.input.dragDistanceThreshold = 10;
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, x: number, y: number) => {
      const g = obj as unknown as Phaser.GameObjects.Container;
      g.x = x;
      g.y = y;
      g.setDepth(1000);
    });
    this.input.on('dragend', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dropped: boolean) => {
      const g = obj as unknown as Phaser.GameObjects.Container;
      g.setDepth(0);
      if (dropped) return;
      this.snapBack(g);
    });
    this.input.on('drop', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, zone: Phaser.GameObjects.Zone) => {
      const col = (zone as any).boardCol as number;
      const row = (zone as any).boardRow as number;
      if (obj instanceof ToolView) {
        this.handleToolDrop(obj, col, row);
      } else {
        this.handlePieceDrop(obj as unknown as PieceView, col, row);
      }
    });

    const unsub = GameState.subscribe(() => this.syncFromState());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsub();
      this.pieces.clear();
      this.toolViews.clear();
      this.flyingPieceIds.clear();
      this.dropZones = [];
    });
  }

  /* ---------- rendering ---------- */

  private drawBoardBackground(w: number, h: number): void {
    const g = this.boardGfx;
    g.clear();
    g.fillStyle(0x2e3a48, 0.92);
    g.fillRoundedRect(this.boardX - 8, this.boardY - 8, w + 16, h + 16, 16);
    g.fillStyle(0x3b4a5e, 1);
    g.fillRoundedRect(this.boardX, this.boardY, w, h, 12);
    g.lineStyle(1, 0x000000, 0.18);
    for (let c = 0; c <= GameConfig.board.cols; c++) {
      const x = this.boardX + c * this.cellSize;
      g.lineBetween(x, this.boardY, x, this.boardY + h);
    }
    for (let r = 0; r <= GameConfig.board.rows; r++) {
      const y = this.boardY + r * this.cellSize;
      g.lineBetween(this.boardX, y, this.boardX + w, y);
    }
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.boardX + col * this.cellSize + this.cellSize / 2,
      y: this.boardY + row * this.cellSize + this.cellSize / 2,
    };
  }

  private spawnPieceView(data: PieceData): PieceView {
    const { x, y } = this.cellCenter(data.col, data.row);
    const view = new PieceView(this, x, y, this.cellSize - 8, data);
    view.setInteractive({ draggable: true });
    this.input.setDraggable(view as unknown as Phaser.GameObjects.GameObject);
    this.pieces.set(data.id, view);
    return view;
  }

  private spawnToolView(data: ToolData): ToolView {
    const { x, y } = this.cellCenter(data.col, data.row);
    const view = new ToolView(this, x, y, this.cellSize - 6, data);
    view.setInteractive({ draggable: true });
    this.input.setDraggable(view as unknown as Phaser.GameObjects.GameObject);
    view.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Suppress tap if the pointer moved (i.e. user is dragging).
      const moved = Phaser.Math.Distance.Between(
        pointer.downX, pointer.downY, pointer.upX, pointer.upY,
      );
      if (moved > 5) return;
      this.onToolTap(view);
    });
    this.toolViews.set(data.id, view);
    return view;
  }

  private syncFromState(): void {
    // Pieces.
    const livePieceIds = new Set(GameState.pieces.map(p => p.id));
    for (const [id, view] of this.pieces) {
      if (!livePieceIds.has(id) && !this.flyingPieceIds.has(id)) {
        view.destroy();
        this.pieces.delete(id);
      }
    }
    for (const p of GameState.pieces) {
      if (this.flyingPieceIds.has(p.id)) continue;
      const view = this.pieces.get(p.id);
      if (!view) {
        this.spawnPieceView(p);
      } else {
        view.setPieceData(p);
        const { x, y } = this.cellCenter(p.col, p.row);
        if (Math.abs(view.x - x) > 1 || Math.abs(view.y - y) > 1) {
          this.tweens.add({ targets: view, x, y, duration: 120, ease: 'Sine.easeOut' });
        }
      }
    }
    // Tools.
    const liveToolIds = new Set(GameState.tools.map(t => t.id));
    for (const [id, view] of this.toolViews) {
      if (!liveToolIds.has(id)) {
        view.destroy();
        this.toolViews.delete(id);
      }
    }
    for (const t of GameState.tools) {
      const view = this.toolViews.get(t.id);
      if (!view) {
        this.spawnToolView(t);
      } else {
        view.setToolData(t);
        const { x, y } = this.cellCenter(t.col, t.row);
        if (Math.abs(view.x - x) > 1 || Math.abs(view.y - y) > 1) {
          this.tweens.add({ targets: view, x, y, duration: 140, ease: 'Sine.easeOut' });
        }
      }
    }
  }

  /* ---------- interactions ---------- */

  private onToolTap(view: ToolView): void {
    // Reserve the upcoming piece id as "flying" BEFORE state mutates, so the
    // sync triggered by triggerTool() won't auto-create a static view for it.
    const upcomingId = GameState.peekNextPieceId();
    this.flyingPieceIds.add(upcomingId);
    const result = GameState.triggerTool(view.toolData.id);
    if (typeof result === 'string') {
      this.flyingPieceIds.delete(upcomingId);
      if (result === 'no-stamina') this.flashCenter('体力不足', 0xff6b6b);
      else this.flashCenter('棋盘满员了！', 0xffd166);
      return;
    }
    view.press();
    this.playSpawnToss(result.piece, result.from);
    this.popStaminaCost(view.x, view.y);
  }

  /**
   * Toss a freshly-created piece from the tool to its destination cell.
   * Snappy (~280ms): pop from scale 0 → peak at scale 1.15 at apex → land at scale 1,
   * with a tiny squash bounce. No trail, no rotation, no sparks (per spec).
   */
  private playSpawnToss(piece: PieceData, from: { col: number; row: number }): void {
    const start = this.cellCenter(from.col, from.row);
    const end = this.cellCenter(piece.col, piece.row);
    const dist = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const arcHeight = Math.min(55, 25 + dist * 0.15);
    const peakX = (start.x + end.x) / 2;
    const peakY = Math.min(start.y, end.y) - arcHeight;

    // Create the view at start. flyingPieceIds was already set in onToolTap
    // so syncFromState will leave it alone.
    const view = this.spawnPieceView(piece);
    view.x = start.x;
    view.y = start.y;
    view.setScale(0);
    view.setDepth(900);

    const upMs = 140;
    const downMs = 130;

    this.tweens.add({
      targets: view,
      x: peakX,
      y: peakY,
      scale: 1.05,
      duration: upMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: view,
          x: end.x,
          y: end.y,
          scale: 1,
          duration: downMs,
          ease: 'Quad.easeIn',
          onComplete: () => {
            view.setDepth(0);
            this.flyingPieceIds.delete(piece.id);
            // Subtle landing squash.
            this.tweens.add({
              targets: view,
              scaleY: 0.94,
              scaleX: 1.04,
              duration: 55,
              yoyo: true,
              ease: 'Sine.easeInOut',
            });
          },
        });
      },
    });
  }

  private popStaminaCost(x: number, y: number): void {
    const txt = this.add.text(x, y - 30, '⚡ -1', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '20px',
      color: '#7fd0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1500);
    this.tweens.add({
      targets: txt,
      y: y - 70,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private handlePieceDrop(view: PieceView, col: number, row: number): void {
    const src = view.pieceData;
    const dst = GameState.pieceAt(col, row);
    const willMerge =
      !!dst && dst.id !== src.id && dst.lineId === src.lineId
      && dst.level === src.level && dst.level < GameConfig.maxLevel;

    if (willMerge && dst) {
      const dstView = this.pieces.get(dst.id);
      const { x, y } = this.cellCenter(col, row);
      this.flyingPieceIds.add(src.id);
      this.flyingPieceIds.add(dst.id);
      view.setDepth(900);
      this.tweens.add({
        targets: view,
        x, y,
        scale: 0.7,
        alpha: 0.55,
        duration: 110,
        ease: 'Sine.easeIn',
        onComplete: () => {
          view.destroy();
          this.pieces.delete(src.id);
          this.flyingPieceIds.delete(src.id);
          this.flyingPieceIds.delete(dst.id);
          GameState.moveOrMerge(src.id, col, row);
          this.playPuff(x, y);
          if (dstView) {
            dstView.setScale(0.6);
            this.tweens.add({
              targets: dstView,
              scale: 1.18,
              duration: 140,
              ease: 'Back.easeOut',
              onComplete: () => {
                this.tweens.add({
                  targets: dstView, scale: 1, duration: 110, ease: 'Sine.easeOut',
                });
              },
            });
          }
        },
      });
      return;
    }

    const result = GameState.moveOrMerge(src.id, col, row);
    if (result) {
      const { x, y } = this.cellCenter(col, row);
      this.tweens.add({ targets: view, x, y, duration: 120, ease: 'Sine.easeOut' });
    } else {
      this.snapBack(view as unknown as Phaser.GameObjects.Container);
    }
  }

  private playPuff(x: number, y: number): void {
    const ring = this.add.graphics().setDepth(1200);
    ring.lineStyle(4, 0xffffff, 0.9);
    ring.strokeCircle(0, 0, 14);
    ring.x = x; ring.y = y;
    this.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    const flash = this.add.graphics().setDepth(1199);
    flash.fillStyle(0xffffff, 0.55);
    flash.fillCircle(0, 0, 28);
    flash.x = x; flash.y = y;
    this.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }


  private handleToolDrop(view: ToolView, col: number, row: number): void {
    const ok = GameState.moveTool(view.toolData.id, col, row);
    if (ok) {
      const { x, y } = this.cellCenter(col, row);
      this.tweens.add({ targets: view, x, y, duration: 140, ease: 'Sine.easeOut' });
    } else {
      this.snapBack(view as unknown as Phaser.GameObjects.Container);
    }
  }

  private snapBack(view: Phaser.GameObjects.Container): void {
    const data = (view as any).pieceData ?? (view as any).toolData;
    if (!data) return;
    const { x, y } = this.cellCenter(data.col, data.row);
    this.tweens.add({ targets: view, x, y, duration: 160, ease: 'Back.easeOut' });
  }

  private flashCenter(text: string, color: number): void {
    const w = this.scale.gameSize.width;
    const h = this.scale.gameSize.height;
    const bg = this.add.graphics().setDepth(2000);
    const txt = this.add.text(w / 2, h / 2, text, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '34px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2001);
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(w / 2 - 200, h / 2 - 36, 400, 72, 14);
    this.tweens.add({
      targets: [bg, txt],
      alpha: 0,
      duration: 900,
      delay: 400,
      onComplete: () => { bg.destroy(); txt.destroy(); },
    });
  }
}
