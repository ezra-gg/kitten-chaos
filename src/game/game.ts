import { CHAOS_SECONDS, LOGICAL_HEIGHT, LOGICAL_WIDTH, PHYSICS_HZ } from '../config/constants';
import { Attractor } from '../entities/attractor';
import { GameLoop } from '../engine/loop';
import { PhysicsWorld } from '../engine/physics';
import { Renderer } from '../render/canvas';
import { GameUI, MenuEntry, Phase } from '../render/ui';
import { generateLevel } from './generator';
import { buildLevel, LevelDef } from './levels';
import { LEVELS } from './levelset';
import { PrepController, PrepTool } from './prep';
import { computeScore } from './scoring';
import { getBest, saveBest } from './storage';

/**
 * Orchestrates the full prep -> chaos -> result flow across levels: loads a level
 * from JSON, runs prep + chaos, scores the outcome, persists the best result,
 * and offers Retry / Next.
 */
export class Game {
  phase: Phase = 'prep';

  private readonly loop: GameLoop;
  private readonly ui: GameUI;

  /**
   * The campaign, which grows forever: fixed levels first, then procedurally
   * generated "endless" levels created on demand as the player advances.
   */
  private readonly levels: LevelDef[] = [...LEVELS];

  private world!: PhysicsWorld;
  private level!: LevelDef;
  private levelIndex = 0;
  private prep!: PrepController;

  private chaosStepsLeft = 0;
  private lastShownSecond = -1;
  private treatDeployed = false;

  constructor(private readonly renderer: Renderer, startIndex = 0) {
    this.ui = new GameUI(document.body, {
      onTool: (t) => this.setTool(t),
      onUndo: () => this.prep.undoLast(),
      onRelease: () => this.release(),
      onSpeed: (s) => this.setSpeed(s),
      onBuyTreat: () => this.prep.buyTreat(),
      onDeployTreat: () => this.deployTreat(),
      onMenu: () => this.showMenu(),
    });
    this.loop = new GameLoop(
      () => this.step(),
      () => this.renderer.render(this.world),
    );
    this.attachPointer();
    // Load a level as a backdrop, then show the title / level-select over it.
    this.loadLevel(startIndex);
    this.showMenu();
    this.loop.start();
  }

  private showMenu(): void {
    this.phase = 'menu';
    this.renderer.camOverlay = false;
    this.loop.speed = 1;
    this.ui.setPhase('menu');
    const entries: MenuEntry[] = LEVELS.map((l, i) => ({
      title: `${i + 1}. ${l.name}`,
      stars: getBest(l.id)?.stars ?? 0,
      kind: 'level',
      index: i,
    }));
    entries.push({ title: 'Endless', stars: 0, kind: 'endless', index: LEVELS.length });
    this.ui.showMenu(entries, (index) => {
      this.ui.hideMenu();
      this.loadLevel(index);
    });
  }

  /** The level at an index, generating fresh endless levels on demand. */
  private levelAt(index: number): LevelDef {
    while (this.levels.length <= index) {
      const n = this.levels.length - LEVELS.length; // 0-based endless offset
      const tier = Math.min(8, 4 + Math.floor(n / 2)); // ramps up, then caps
      this.levels.push(generateLevel(900000 + n * 1000, tier));
    }
    return this.levels[index];
  }

  private loadLevel(index: number): void {
    this.levelIndex = index;
    this.renderer.camOverlay = false; // back home: prep view, no cam
    // A fresh random chaos seed every load (including retries), so the kittens
    // take a different path each time instead of replaying the same run. The
    // auditor verifies levels stay fair across a spread of seeds.
    const runSeed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
    const built = buildLevel(this.levelAt(index), runSeed);
    this.world = built.world;
    this.level = built.level;
    this.world.onBreak = ({ item, speed }) => {
      console.log(`💥 ${item.spec.label} broke (impact ${speed.toFixed(1)})`);
    };

    this.prep = new PrepController(this.world, this.level.moves);
    this.prep.onChange = () => this.syncMoves();
    this.prep.onMessage = (text) => this.ui.flashMessage(text);

    this.phase = 'prep';
    this.chaosStepsLeft = CHAOS_SECONDS * PHYSICS_HZ;
    this.lastShownSecond = -1;
    this.treatDeployed = false;

    this.world.freezeItems();
    const endlessFrom = LEVELS.length;
    const title =
      index >= endlessFrom
        ? `Endless ${index - endlessFrom + 1}: ${this.level.name}`
        : `Level ${index + 1}: ${this.level.name}`;
    this.ui.setTitle(title);
    this.ui.setAvailableTools(this.level.actionsAvailable);
    const firstTool = this.level.actionsAvailable.find((a): a is PrepTool => a !== 'treat') ?? 'relocate';
    this.setTool(firstTool);
    this.ui.setPhase('prep');
    this.syncMoves();
  }

  private step(): void {
    if (this.phase !== 'chaos') return;
    this.world.step();
    this.chaosStepsLeft--;
    const sec = Math.ceil(this.chaosStepsLeft / PHYSICS_HZ);
    if (sec !== this.lastShownSecond) {
      this.ui.setTimer(sec);
      this.lastShownSecond = sec;
    }
    if (this.chaosStepsLeft <= 0) this.endChaos();
  }

  private syncMoves(): void {
    this.ui.setMoves(this.prep.movesRemaining, this.prep.budget);
    this.ui.setTreatPurchased(this.prep.treatPurchased);
  }

  private setTool(tool: PrepTool): void {
    this.prep.setTool(tool);
    this.ui.setActiveTool(tool);
  }

  private release(): void {
    if (this.phase !== 'prep') return;
    this.phase = 'chaos';
    this.world.releaseItems();
    this.renderer.camOverlay = true; // you're out of the house; watch the cat cam
    this.loop.speed = 1;
    this.ui.setPhase('chaos');
    this.ui.setActiveSpeed(1);
    this.ui.setTimer(CHAOS_SECONDS);
    this.ui.setTreatArmed(this.prep.treatPurchased);
  }

  private deployTreat(): void {
    if (this.phase !== 'chaos' || !this.prep.treatPurchased || this.treatDeployed) return;
    this.treatDeployed = true;
    const bowl = this.world.addAttractor(new Attractor('treat', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40));
    bowl.available = true;
    bowl.ttl = 4 * PHYSICS_HZ;
    for (const kitten of this.world.kittens) kitten.lureToTreat(bowl);
    this.ui.spendTreat();
  }

  private setSpeed(speed: 1 | 2 | 'skip'): void {
    if (this.phase !== 'chaos') return;
    if (speed === 'skip') {
      while (this.chaosStepsLeft > 0) {
        this.world.step();
        this.chaosStepsLeft--;
      }
      this.endChaos();
      return;
    }
    this.loop.speed = speed;
    this.ui.setActiveSpeed(speed);
  }

  private endChaos(): void {
    this.phase = 'done';
    this.loop.speed = 1;

    const result = computeScore(this.world.items, this.prep.movesRemaining);
    const prevBest = getBest(this.level.id);
    const isNewBest = saveBest(this.level.id, { score: result.score, stars: result.stars });

    this.ui.setPhase('done');
    this.ui.showResult(
      {
        levelName: this.level.name,
        stars: result.stars,
        score: result.score,
        survivedValue: result.survivedValue,
        totalValue: result.totalValue,
        moveBonus: result.moveBonus,
        incidents: result.incidents,
        best: prevBest,
        isNewBest,
        hasNext: true, // endless: there is always another level
      },
      {
        onRetry: () => this.loadLevel(this.levelIndex),
        onNext: () => this.loadLevel(this.levelIndex + 1),
        onMenu: () => this.showMenu(),
      },
    );
  }

  private attachPointer(): void {
    const el = this.renderer.element;
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.phase !== 'prep') return;
      const p = this.renderer.clientToLogical(e.clientX, e.clientY);
      this.prep.pointerDown(p.x, p.y);
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.phase !== 'prep') return;
      const p = this.renderer.clientToLogical(e.clientX, e.clientY);
      this.prep.pointerMove(p.x, p.y);
    });
    window.addEventListener('pointerup', () => {
      if (this.phase !== 'prep') return;
      this.prep.pointerUp();
    });
  }
}
