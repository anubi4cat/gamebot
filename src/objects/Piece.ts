import Phaser from 'phaser';
import { getLine, getPieceName } from '../config/lines';
import { PieceData } from '../state/GameState';

/**
 * Visual representation of a board piece. Built from primitives only —
 * swap to sprites later by replacing the contents of `redraw`.
 */
export class PieceView extends Phaser.GameObjects.Container {
  pieceData: PieceData;
  size: number;
  private bg!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number, data: PieceData) {
    super(scene, x, y);
    this.pieceData = data;
    this.size = size;

    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, -size * 0.18, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: `${Math.round(size * 0.18)}px`,
      color: '#ffffff',
    }).setOrigin(0.5);
    this.levelText = scene.add.text(0, size * 0.22, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: `${Math.round(size * 0.22)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add([this.bg, this.label, this.levelText]);
    this.redraw();

    this.setSize(size, size);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  setPieceData(data: PieceData): void {
    this.pieceData = data;
    this.redraw();
  }

  redraw(): void {
    const line = getLine(this.pieceData.lineId);
    const r = this.size / 2 - 4;
    this.bg.clear();
    // Shadow.
    this.bg.fillStyle(0x000000, 0.18);
    this.bg.fillRoundedRect(-r, -r + 4, r * 2, r * 2, 14);
    // Body — darken with level for higher-tier feel.
    const tint = darken(line.color, 1 - (this.pieceData.level - 1) * 0.04);
    this.bg.fillStyle(tint, 1);
    this.bg.fillRoundedRect(-r, -r, r * 2, r * 2, 14);
    // Border.
    this.bg.lineStyle(2, 0xffffff, 0.35);
    this.bg.strokeRoundedRect(-r, -r, r * 2, r * 2, 14);

    this.label.setText(getPieceName(this.pieceData.lineId, this.pieceData.level));
    this.levelText.setText(`Lv.${this.pieceData.level}`);
  }
}

function darken(hex: number, factor: number): number {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.min(255, (hex & 0xff) * factor));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
