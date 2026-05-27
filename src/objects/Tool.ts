import Phaser from 'phaser';
import { getLine } from '../config/lines';
import { ToolData } from '../state/GameState';

/**
 * Visual for a production tool sitting on the board. Distinct from PieceView:
 * darker, rounded body with a hammer/anvil glyph + line label.
 */
export class ToolView extends Phaser.GameObjects.Container {
  toolData: ToolData;
  size: number;
  private bg!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private icon!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number, data: ToolData) {
    super(scene, x, y);
    this.toolData = data;
    this.size = size;

    this.bg = scene.add.graphics();
    this.icon = scene.add.text(0, -size * 0.15, '⚒', {
      fontSize: `${Math.round(size * 0.4)}px`,
      color: '#ffffff',
    }).setOrigin(0.5);
    this.label = scene.add.text(0, size * 0.22, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: `${Math.round(size * 0.16)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add([this.bg, this.icon, this.label]);
    this.redraw();
    this.setSize(size, size);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  setToolData(data: ToolData): void {
    this.toolData = data;
    this.redraw();
  }

  redraw(): void {
    const line = getLine(this.toolData.lineId);
    const r = this.size / 2 - 4;
    this.bg.clear();
    // Outer ring — tinted by line for identification.
    this.bg.fillStyle(line.color, 1);
    this.bg.fillRoundedRect(-r, -r, r * 2, r * 2, 12);
    // Dark inner panel.
    const inset = 6;
    this.bg.fillStyle(0x2a2218, 1);
    this.bg.fillRoundedRect(-r + inset, -r + inset, (r - inset) * 2, (r - inset) * 2, 8);
    // Subtle border.
    this.bg.lineStyle(2, 0xffffff, 0.5);
    this.bg.strokeRoundedRect(-r, -r, r * 2, r * 2, 12);
    this.label.setText(line.name);
  }

  /** Press-feedback animation (called by scene). */
  press(): void {
    this.scene.tweens.add({
      targets: this,
      scale: 0.9,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }
}
