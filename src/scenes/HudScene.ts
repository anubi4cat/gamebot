import Phaser from 'phaser';
import { GameConfig } from '../config/gameConfig';
import { GameState } from '../state/GameState';
import { NPCS, TaskInstance } from '../config/tasks';
import { getPieceName, getLine } from '../config/lines';

/**
 * Persistent overlay: top resource bar, NPC task strip, and bottom city-switch button.
 */
export class HudScene extends Phaser.Scene {
  private staminaText!: Phaser.GameObjects.Text;
  private staminaTimer!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private gemText!: Phaser.GameObjects.Text;
  private taskCards: Phaser.GameObjects.Container[] = [];
  private cityBtn!: Phaser.GameObjects.Container;

  constructor() { super('Hud'); }

  create(): void {
    this.buildTopBar();
    this.buildTaskStrip();
    this.buildCityButton();

    GameState.subscribe(() => this.refresh());
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        GameState.tickStaminaRegen();
        this.refresh();
      },
    });
    this.refresh();
  }

  /* ---------- top resource bar ---------- */

  private buildTopBar(): void {
    const w = this.scale.gameSize.width;
    const g = this.add.graphics();
    g.fillStyle(0x1a1f29, 0.95);
    g.fillRoundedRect(8, 8, w - 16, 64, 16);

    this.staminaText = this.add.text(28, 22, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px',
      color: '#7fd0ff',
      fontStyle: 'bold',
    });
    this.staminaTimer = this.add.text(28, 48, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '13px',
      color: '#9fb1c4',
    });

    this.coinText = this.add.text(w / 2, 38, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.gemText = this.add.text(w - 70, 38, '', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px',
      color: '#a3f7bf',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // Reset save button.
    const resetBtn = this.add.text(w - 16, 38, '⋮', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#3b4a5e',
      padding: { left: 10, right: 10, top: 0, bottom: 4 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerup', () => this.showResetConfirm());
  }

  private showResetConfirm(): void {
    const w = this.scale.gameSize.width;
    const h = this.scale.gameSize.height;
    const layer = this.add.container(0, 0).setDepth(5000);

    const veil = this.add.graphics();
    veil.fillStyle(0x000000, 0.65);
    veil.fillRect(0, 0, w, h);
    veil.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

    const panel = this.add.graphics();
    const pw = 460, ph = 220;
    panel.fillStyle(0x2a3140, 1);
    panel.fillRoundedRect(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 16);
    panel.lineStyle(2, 0xffffff, 0.3);
    panel.strokeRoundedRect(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 16);

    const title = this.add.text(w / 2, h / 2 - 56, '重置存档？', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const note = this.add.text(w / 2, h / 2 - 14, '棋盘 / 资源 / 城市 / 任务\n全部清空，不可恢复', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '15px',
      color: '#bcc4d0',
      align: 'center',
    }).setOrigin(0.5);

    const yes = this.add.text(w / 2 - 90, h / 2 + 52, '确认重置', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#b04a4a',
      padding: { left: 18, right: 18, top: 8, bottom: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const no = this.add.text(w / 2 + 90, h / 2 + 52, '取消', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#3b4a5e',
      padding: { left: 22, right: 22, top: 8, bottom: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const close = () => layer.destroy();
    yes.on('pointerup', () => {
      GameState.resetForDebug();
      close();
    });
    no.on('pointerup', close);

    layer.add([veil, panel, title, note, yes, no]);
  }

  /* ---------- task strip ---------- */

  private buildTaskStrip(): void {
    const w = this.scale.gameSize.width;
    const top = 84;
    const cardW = (w - 32 - (NPCS.length - 1) * 8) / NPCS.length;
    const cardH = 122;

    NPCS.forEach((npc, idx) => {
      const x = 16 + idx * (cardW + 8) + cardW / 2;
      const y = top + cardH / 2;
      const c = this.add.container(x, y);

      const bg = this.add.graphics();
      bg.fillStyle(0x2a3140, 0.95);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
      bg.lineStyle(2, npc.color, 0.6);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);

      // NPC placeholder portrait.
      const portrait = this.add.graphics();
      portrait.fillStyle(npc.color, 1);
      portrait.fillCircle(-cardW / 2 + 28, -cardH / 2 + 28, 22);
      const npcName = this.add.text(-cardW / 2 + 56, -cardH / 2 + 14, npc.name, {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      });

      const reqLabel = this.add.text(-cardW / 2 + 10, -10, '', {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '14px',
        color: '#e6e6e6',
        wordWrap: { width: cardW - 20 },
      });

      const rewardLabel = this.add.text(-cardW / 2 + 10, 26, '', {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '13px',
        color: '#ffd166',
      });

      const submitBtn = this.add.text(0, cardH / 2 - 18, '提交', {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#3b8c5a',
        padding: { left: 14, right: 14, top: 4, bottom: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      submitBtn.on('pointerup', () => this.trySubmit(npc.id, submitBtn));

      c.add([bg, portrait, npcName, reqLabel, rewardLabel, submitBtn]);
      (c as any)._req = reqLabel;
      (c as any)._reward = rewardLabel;
      (c as any)._submit = submitBtn;
      (c as any)._npcId = npc.id;
      this.taskCards.push(c);
    });
  }

  /* ---------- city button ---------- */

  private buildCityButton(): void {
    const w = this.scale.gameSize.width;
    const h = this.scale.gameSize.height;
    const btnW = 120;
    const btnH = 64;
    const c = this.add.container(w - btnW / 2 - 16, h - btnH / 2 - 16);
    const g = this.add.graphics();
    g.fillStyle(0xc88a4a, 1);
    g.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
    g.lineStyle(2, 0xffffff, 0.4);
    g.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
    const label = this.add.text(0, 0, '城市', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([g, label]);
    c.setSize(btnW, btnH);
    c.setInteractive(new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    c.on('pointerup', () => {
      this.scene.stop('Board');
      this.scene.stop('Hud');
      this.scene.launch('City');
    });
    this.cityBtn = c;
  }

  /* ---------- refresh ---------- */

  private refresh(): void {
    this.staminaText.setText(`体力 ${GameState.stamina}/${GameConfig.stamina.max}`);
    const remain = GameState.millisToNextStamina();
    this.staminaTimer.setText(
      GameState.stamina >= GameConfig.stamina.max
        ? '已满'
        : `+1 还需 ${Math.ceil(remain / 1000)}s`,
    );
    this.coinText.setText(`💰 ${GameState.coin}`);
    this.gemText.setText(`💎 ${GameState.gem}`);

    for (const card of this.taskCards) {
      const npcId = (card as any)._npcId as string;
      const task: TaskInstance | undefined = GameState.taskQueue[npcId];
      const req = (card as any)._req as Phaser.GameObjects.Text;
      const reward = (card as any)._reward as Phaser.GameObjects.Text;
      const submit = (card as any)._submit as Phaser.GameObjects.Text;
      if (!task) {
        req.setText('暂无任务');
        reward.setText('');
        submit.setBackgroundColor('#5a5a5a');
        continue;
      }
      const line = getLine(task.lineId);
      const have = GameState.pieces.filter(p => p.lineId === task.lineId && p.level === task.level).length;
      const fulfilled = have >= task.count;
      req.setText(
        `要 ${line.name}·${getPieceName(task.lineId, task.level)}\n` +
        `${fulfilled ? '✓ ' : ''}${have} / ${task.count}`,
      );
      req.setColor(fulfilled ? '#a3f7bf' : '#e6e6e6');
      reward.setText(`💰${task.reward.coin}  💎${task.reward.gem}`);
      submit.setBackgroundColor(fulfilled ? '#3bb066' : '#3b8c5a');
      submit.setAlpha(fulfilled ? 1 : 0.7);
    }
  }

  private trySubmit(npcId: string, btn: Phaser.GameObjects.Text): void {
    const ok = GameState.submitTask(npcId);
    if (!ok) {
      const orig = btn.style.backgroundColor as string;
      btn.setBackgroundColor('#b04a4a');
      btn.setText('物品不够');
      this.time.delayedCall(700, () => {
        btn.setBackgroundColor(orig || '#3b8c5a');
        btn.setText('提交');
      });
    }
  }
}
