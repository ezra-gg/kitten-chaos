export interface DoorSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A cabinet/closet opening (section 3.1). When closed, items inside are sealed away -
 * kittens can't reach them and they can't move - and the player spends one move
 * to close it. Doors start open.
 */
export class Door {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  closed = false;

  constructor(spec: DoorSpec) {
    this.id = spec.id;
    this.x = spec.x;
    this.y = spec.y;
    this.w = spec.w;
    this.h = spec.h;
  }

  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}
