import Matter from 'matter-js';

/**
 * A surface is a static body kittens walk on and items rest on:
 * floors, walls, shelves, tables, counters.
 *
 * Authoring convention (matches the level JSON schema): x/y is the TOP-LEFT
 * corner, w/h the size. Matter wants a center, so we convert.
 */
export interface SurfaceSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Visual role, affects how it's drawn. Defaults to 'shelf'. */
  kind?: 'floor' | 'wall' | 'shelf';
}

export class Surface {
  readonly id: string;
  readonly spec: SurfaceSpec;
  readonly body: Matter.Body;
  readonly kind: 'floor' | 'wall' | 'shelf';

  constructor(spec: SurfaceSpec) {
    this.id = spec.id;
    this.spec = spec;
    this.kind = spec.kind ?? 'shelf';
    this.body = Matter.Bodies.rectangle(
      spec.x + spec.w / 2,
      spec.y + spec.h / 2,
      spec.w,
      spec.h,
      {
        isStatic: true,
        friction: 0.8,
        label: `surface:${spec.id}`,
      },
    );
    // Back-reference so collision handlers and the renderer can find us.
    (this.body as unknown as { surface: Surface }).surface = this;
  }

  /** The y coordinate of the surface's top edge, where items sit. */
  get topY(): number {
    return this.spec.y;
  }
}

/** Retrieve the Surface attached to a body, if any. */
export function surfaceOf(body: Matter.Body): Surface | undefined {
  return (body as unknown as { surface?: Surface }).surface;
}
