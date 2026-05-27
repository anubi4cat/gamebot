import Phaser from 'phaser';
import { GameConfig } from './config/gameConfig';
import { GameState } from './state/GameState';
import { BootScene } from './scenes/BootScene';
import { BoardScene } from './scenes/BoardScene';
import { HudScene } from './scenes/HudScene';
import { CityScene } from './scenes/CityScene';

GameState.init();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f2530',
  width: GameConfig.viewport.width,
  height: GameConfig.viewport.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, BoardScene, HudScene, CityScene],
});

(window as any).GameState = GameState;
