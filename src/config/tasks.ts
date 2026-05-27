import { LINES } from './lines';

export interface NpcDef {
  id: string;
  name: string;
  /** Placeholder portrait tint. */
  color: number;
}

export const NPCS: NpcDef[] = [
  { id: 'npc_a', name: '阿绣', color: 0xb86b89 },
  { id: 'npc_b', name: '柳青', color: 0x6e9d7a },
  { id: 'npc_c', name: '商伯', color: 0xc88a4a },
];

export interface TaskReward {
  coin: number;
  gem: number;
}

export interface TaskInstance {
  id: string;
  npcId: string;
  lineId: string;
  level: number;
  count: number;
  reward: TaskReward;
}

let taskIdCounter = 0;

/**
 * Generate a random task. Difficulty bias keyed by NPC index so the three
 * queues feel distinct: A asks for low-tier, B mid, C high.
 */
export function rollTask(npcId: string): TaskInstance {
  const npcIdx = NPCS.findIndex(n => n.id === npcId);
  const tier = npcIdx === 0 ? 0 : npcIdx === 1 ? 1 : 2;

  const levelPool = [
    [1, 2, 3],
    [3, 4, 5],
    [5, 6, 7],
  ][tier];
  const countPool = [
    [2, 3],
    [1, 2],
    [1, 1],
  ][tier];

  const lineId = LINES[Math.floor(Math.random() * LINES.length)].id;
  const level = levelPool[Math.floor(Math.random() * levelPool.length)];
  const count = countPool[Math.floor(Math.random() * countPool.length)];

  const reward: TaskReward = {
    coin: level * 10 * count + tier * 20,
    gem: tier + Math.floor(level / 3),
  };

  taskIdCounter += 1;
  return {
    id: `t_${Date.now()}_${taskIdCounter}`,
    npcId,
    lineId,
    level,
    count,
    reward,
  };
}
