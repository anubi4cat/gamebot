import Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { BUILDINGS, BuildingDef } from '../config/buildings';

/**
 * City rebuild scene. Each building is rendered as a placeholder rectangle
 * whose color & detail evolve with stage (破败 -> 修复中 -> 完工).
 */
export class CityScene extends Phaser.Scene {
  private buildingViews = new Map<string, BuildingView>();
  private gemText!: Phaser.GameObjects.Text;

  constructor() { super('City'); }

  create(): void {
    const { width, height } = this.scale.gameSize;

    // Sky gradient backdrop.
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x4a6b8c, 0x4a6b8c, 0x8fb8c9, 0x8fb8c9, 1);
    sky.fillRect(0, 0, width, height);
    // Ground.
    const ground = this.add.graphics();
    ground.fillStyle(0x6b5a3e, 1);
    ground.fillRect(0, height * 0.62, width, height * 0.38);

    // Header.
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x1a1f29, 0.85);
    headerBg.fillRect(0, 0, width, 70);
    this.add.text(width / 2, 35, '· 重建城市 ·', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.gemText = this.add.text(width - 16, 35, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px',
      color: '#a3f7bf',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // Back button.
    const back = this.add.text(16, 35, '< 返回', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#3b4a5e',
      padding: { left: 12, right: 12, top: 6, bottom: 6 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => {
      this.scene.stop();
      this.scene.launch('Board');
      this.scene.launch('Hud');
    });

    // Buildings.
    for (const def of BUILDINGS) {
      const view = new BuildingView(this, def, width, height);
      this.buildingViews.set(def.id, view);
    }

    const unsub = GameState.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsub();
      this.buildingViews.clear();
    });
    this.refresh();
  }

  private refresh(): void {
    this.gemText.setText(`💎 ${GameState.gem}`);
    for (const view of this.buildingViews.values()) view.refresh();
  }
}

class BuildingView {
  private scene: Phaser.Scene;
  private def: BuildingDef;
  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private btn: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, def: BuildingDef, w: number, h: number) {
    this.scene = scene;
    this.def = def;
    const x = def.x * w;
    const y = def.y * h;
    this.container = scene.add.container(x, y);
    this.body = scene.add.graphics();
    this.label = scene.add.text(0, -def.h / 2 - 14, def.name, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.btn = scene.add.text(0, def.h / 2 + 12, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#3b8c5a',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.btn.on('pointerup', () => this.onRepair());
    this.container.add([this.body, this.label, this.btn]);
    this.refresh();
  }

  refresh(): void {
    const stage = GameState.buildingStage(this.def.id);
    const isMax = stage >= this.def.stages - 1;
    const ratio = stage / Math.max(1, this.def.stages - 1);
    this.body.clear();

    // Footprint shadow.
    this.body.fillStyle(0x000000, 0.25);
    this.body.fillEllipse(0, this.def.h / 2 + 6, this.def.w * 0.9, 16);

    // Stage 0 = ruin (dark, jagged). Stage N = bright complete.
    const baseColor = lerpColor(0x4d4538, 0xd8c79a, ratio);
    const roofColor = lerpColor(0x352f25, 0xa15a3e, ratio);

    // Body.
    this.body.fillStyle(baseColor, 1);
    this.body.fillRoundedRect(-this.def.w / 2, -this.def.h / 2 + this.def.h * 0.3, this.def.w, this.def.h * 0.7, 6);
    // Roof — taller as stage advances.
    const roofH = this.def.h * (0.25 + 0.1 * ratio);
    this.body.fillStyle(roofColor, 1);
    this.body.fillTriangle(
      -this.def.w / 2 - 6, -this.def.h / 2 + this.def.h * 0.3,
      this.def.w / 2 + 6, -this.def.h / 2 + this.def.h * 0.3,
      0, -this.def.h / 2 + this.def.h * 0.3 - roofH,
    );
    // Door appears at stage >= 1.
    if (stage >= 1) {
      this.body.fillStyle(0x2c1f12, 1);
      this.body.fillRoundedRect(-15, this.def.h / 2 - 40, 30, 40, 4);
    }
    // Windows appear at stage >= 2.
    if (stage >= 2) {
      this.body.fillStyle(0xfff0a8, 0.9);
      this.body.fillRoundedRect(-this.def.w / 2 + 14, -10, 22, 22, 3);
      this.body.fillRoundedRect(this.def.w / 2 - 36, -10, 22, 22, 3);
    }
    // Cracks/ruin overlay at stage 0.
    if (stage === 0) {
      this.body.lineStyle(2, 0x000000, 0.5);
      this.body.lineBetween(-this.def.w / 4, -this.def.h / 4, this.def.w / 6, this.def.h / 4);
      this.body.lineBetween(this.def.w / 6, -this.def.h / 4, -this.def.w / 8, this.def.h / 5);
    }

    if (isMax) {
      this.btn.setText('已完工');
      this.btn.setBackgroundColor('#5a5a5a');
      this.btn.disableInteractive();
    } else {
      const cost = this.def.stageCosts[stage];
      this.btn.setText(`修复  💎${cost}`);
      this.btn.setBackgroundColor('#3b8c5a');
      this.btn.setInteractive({ useHandCursor: true });
    }
  }

  private onRepair(): void {
    const ok = GameState.repairBuilding(this.def.id);
    if (!ok) {
      const original = this.btn.style.backgroundColor as string;
      this.btn.setBackgroundColor('#b04a4a');
      this.btn.setText('💎不足');
      this.scene.time.delayedCall(700, () => {
        this.btn.setBackgroundColor(original || '#3b8c5a');
        this.refresh();
      });
    }
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
