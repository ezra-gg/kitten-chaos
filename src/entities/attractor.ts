export type AttractorKind = 'box' | 'toy' | 'treat';

/**
 * A lure the player deploys to distract kittens (section 3.1):
 *  - box:   a cardboard box on the floor; a kitten that finds it sits in it.
 *  - toy:   a toy mouse; attracts the nearest kitten, who plays then bats it away.
 *  - treat: a bowl; when triggered mid-chaos, BOTH kittens run to it.
 *
 * Kittens handle the "how long" per personality (section 4.3): the Batter is a sucker
 * for the box, the Zoomer for the toy.
 */
export class Attractor {
  readonly kind: AttractorKind;
  x: number;
  y: number;
  /** Attraction radius; kittens within it are drawn in. */
  readonly radius: number;
  /** Still able to attract a new kitten. */
  available: boolean;
  /** Permanently used up (box sat in, toy batted away, treat finished). */
  spent = false;
  /** Countdown (steps) for timed attractors like the treat; -1 if untimed. */
  ttl = -1;

  constructor(kind: AttractorKind, x: number, y: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.radius = kind === 'box' ? 560 : kind === 'toy' ? 320 : Infinity;
    // The treat only attracts once the player triggers it mid-chaos.
    this.available = kind !== 'treat';
  }
}
