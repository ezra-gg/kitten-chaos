import { MAX_FRAME_MS, MAX_SUBSTEPS, PHYSICS_STEP_MS } from '../config/constants';

/**
 * Fixed-timestep game loop. Physics runs in whole 60 Hz steps (deterministic);
 * rendering happens once per animation frame. A render-time `alpha` is provided
 * for optional interpolation between the last two physics states.
 */
export class GameLoop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  /** Simulation speed multiplier (1x, 2x, ...). */
  speed = 1;

  constructor(
    private readonly onStep: () => void,
    private readonly onRender: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private frame = (now: number): void => {
    if (!this.running) return;

    let elapsed = now - this.last;
    this.last = now;
    if (elapsed > MAX_FRAME_MS) elapsed = MAX_FRAME_MS;

    this.accumulator += elapsed * this.speed;

    let substeps = 0;
    while (this.accumulator >= PHYSICS_STEP_MS && substeps < MAX_SUBSTEPS) {
      this.onStep();
      this.accumulator -= PHYSICS_STEP_MS;
      substeps++;
    }
    // Drop any backlog we couldn't catch up on, so we don't fast-forward later.
    if (substeps === MAX_SUBSTEPS) this.accumulator = 0;

    this.onRender(this.accumulator / PHYSICS_STEP_MS);
    requestAnimationFrame(this.frame);
  };
}
