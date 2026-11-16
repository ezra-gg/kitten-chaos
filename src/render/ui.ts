import { ActionName, PrepTool } from '../game/prep';

export type Phase = 'menu' | 'prep' | 'chaos' | 'done';

export interface MenuEntry {
  title: string;
  stars: number;
  kind: 'level' | 'endless';
  index: number;
}

export interface UICallbacks {
  onTool: (tool: PrepTool) => void;
  onUndo: () => void;
  onRelease: () => void;
  onSpeed: (speed: 1 | 2 | 'skip') => void;
  onBuyTreat: () => void;
  onDeployTreat: () => void;
  onMenu: () => void;
}

export interface ResultData {
  levelName: string;
  stars: number;
  score: number;
  survivedValue: number;
  totalValue: number;
  moveBonus: number;
  incidents: { label: string; culprit: string | null; kind: 'broke' | 'knocked' }[];
  best: { score: number; stars: number } | null;
  isNewBest: boolean;
  hasNext: boolean;
}

const TOOL_LABELS: Record<PrepTool, string> = {
  relocate: '↔ Relocate',
  putty: '• Putty (1)',
  box: '📦 Box (2)',
  toy: '🐭 Toy (1)',
  closeDoor: '🚪 Door (1)',
};

const TOOL_TIPS: Record<PrepTool, string> = {
  relocate: 'Drag an item to a safer spot. The first move of an item costs 1.',
  putty: 'Stick an item down so the cats leave it alone. Costs 1.',
  box: 'Drop a box on the floor. A kitten climbs in and stays a while. Costs 2.',
  toy: 'Place a toy that lures the nearest kitten away to play. Costs 1.',
  closeDoor: 'Click a cabinet to seal it. Anything inside stays safe. Costs 1.',
};

const STYLE = `
.kc-ui { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #f4efe6; }
.kc-ui button { pointer-events: auto; cursor: pointer; font: inherit; }
.kc-moves { position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  background: rgba(27,23,38,0.85); border: 1px solid #4a4160; border-radius: 10px;
  padding: 8px 16px; font-weight: 600; letter-spacing: 0.02em; }
.kc-moves .n { color: #ffd166; font-size: 1.15em; }
.kc-bar { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 8px; align-items: center; background: rgba(27,23,38,0.9);
  border: 1px solid #4a4160; border-radius: 14px; padding: 8px; max-width: 94vw; flex-wrap: wrap; justify-content: center; }
.kc-bar.hidden { display: none; }
.kc-btn { background: #39324a; color: #f4efe6; border: 1px solid #554b6e;
  border-radius: 10px; padding: 10px 13px; font-weight: 600; transition: background 0.1s, transform 0.05s; }
.kc-btn:hover { background: #473d5e; }
.kc-btn:active { transform: translateY(1px); }
.kc-btn.active { background: #ffd166; color: #2a2438; border-color: #ffd166; }
.kc-btn.primary { background: #e86a7c; border-color: #e86a7c; color: #fff; }
.kc-btn.primary:hover { background: #f07c8d; }
.kc-btn[disabled] { opacity: 0.45; cursor: default; }
.kc-sep { width: 1px; align-self: stretch; background: #4a4160; margin: 2px 4px; }
.kc-timer { font-weight: 700; font-size: 1.1em; min-width: 54px; text-align: center; letter-spacing: 0.03em; }
.kc-timer .warn { color: #ff8a8a; }
.kc-banner { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  background: rgba(27,23,38,0.95); border: 1px solid #4a4160; border-radius: 16px;
  padding: 20px 28px; text-align: center; max-width: 80%; display: none; }
.kc-banner.show { display: block; }
.kc-banner h2 { margin: 0 0 6px; }
.kc-title { position: absolute; top: 16px; left: 16px; font-weight: 700; font-size: 1.05em; color: #e9e1f2; text-shadow: 0 1px 3px rgba(0,0,0,0.5); }
.kc-topmenu { position: absolute; top: 13px; right: 14px; pointer-events: auto; cursor: pointer;
  background: rgba(27,23,38,0.85); color: #f4efe6; border: 1px solid #4a4160; border-radius: 10px;
  padding: 8px 14px; font-weight: 600; }
.kc-topmenu:hover { background: #473d5e; }
.kc-topmenu.hidden { display: none; }
.kc-result { min-width: 300px; }
.kc-stars { font-size: 2.1em; letter-spacing: 6px; margin: 2px 0 8px; }
.kc-star-on { color: #ffd166; } .kc-star-off { color: #574f68; }
.kc-score { font-size: 1.3em; font-weight: 700; }
.kc-best { color: #b8b0c8; font-size: 0.85em; margin-top: 3px; }
.kc-newbest { color: #ffd166; font-weight: 700; margin-top: 4px; }
.kc-incidents { text-align: left; margin: 12px auto; max-height: 160px; overflow: auto; font-size: 0.9em; }
.kc-incidents ul { margin: 0; padding-left: 4px; list-style: none; }
.kc-incidents li { margin: 3px 0; }
.kc-incidents .ok { text-align: center; padding: 6px 0; }
.kc-incidents .ok-big { color: #9ad07a; font-size: 1.25em; font-weight: 700; }
.kc-incidents .ok-sub { color: #b8b0c8; font-size: 0.9em; margin-top: 3px; }
.kc-result-btns { display: flex; gap: 10px; justify-content: center; margin-top: 10px; }
.kc-hint { position: absolute; bottom: 74px; left: 50%; transform: translateX(-50%);
  font-size: 0.85em; color: #b8b0c8; background: rgba(27,23,38,0.6); padding: 4px 10px; border-radius: 8px; max-width: 90vw; text-align: center; }
.kc-hint.hidden { display: none; }
.kc-bar.kc-chaosbar { top: 14px; bottom: auto; }
.kc-tip { position: absolute; pointer-events: none; z-index: 20; display: none; max-width: 240px;
  transform: translate(-50%, -100%); background: rgba(20,17,28,0.97); color: #f4efe6;
  border: 1px solid #554b6e; border-radius: 8px; padding: 7px 10px; font-size: 0.82em; line-height: 1.35;
  box-shadow: 0 4px 14px rgba(0,0,0,0.45); }
.kc-tip.show { display: block; }
.kc-menu { position: absolute; inset: 0; pointer-events: auto; background: rgba(20,17,28,0.97);
  display: none; flex-direction: column; align-items: center; overflow: auto; padding: 26px 16px; }
.kc-menu.show { display: flex; }
.kc-menu h1 { margin: 6px 0 2px; font-size: 2.1em; letter-spacing: 0.01em; }
.kc-menu .sub { color: #b8b0c8; margin-bottom: 20px; }
.kc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; width: 100%; max-width: 720px; }
.kc-tile { pointer-events: auto; cursor: pointer; background: #39324a; border: 1px solid #554b6e;
  border-radius: 12px; padding: 14px 12px; text-align: left; color: #f4efe6; font: inherit;
  transition: background 0.1s, transform 0.05s; }
.kc-tile:hover { background: #473d5e; }
.kc-tile:active { transform: translateY(1px); }
.kc-tile.endless { background: #2f3a4a; border-color: #4a6078; }
.kc-tile-name { font-weight: 600; margin-bottom: 7px; }
.kc-tile-stars { font-size: 1.1em; letter-spacing: 3px; }
.kc-tile-note { color: #9ad0ff; font-size: 0.9em; }
`;

/** DOM overlay: move counter + prep toolbar, chaos controls, and result screen. */
export class GameUI {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly movesEl: HTMLDivElement;
  private readonly prepBar: HTMLDivElement;
  private readonly chaosBar: HTMLDivElement;
  private readonly timerEl: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private readonly toolButtons: Record<PrepTool, HTMLButtonElement>;
  private readonly treatBtn: HTMLButtonElement;
  private readonly speedButtons: Record<string, HTMLButtonElement>;
  private readonly treatDeployBtn: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private readonly topMenuBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, cb: UICallbacks) {
    if (!document.getElementById('kc-style')) {
      const style = document.createElement('style');
      style.id = 'kc-style';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    this.root = el('div', 'kc-ui');
    this.titleEl = el('div', 'kc-title');
    this.movesEl = el('div', 'kc-moves');
    this.root.append(this.titleEl, this.movesEl);

    // Prep toolbar.
    this.prepBar = el('div', 'kc-bar');
    this.toolButtons = {
      relocate: button(TOOL_LABELS.relocate, 'kc-btn', () => cb.onTool('relocate')),
      putty: button(TOOL_LABELS.putty, 'kc-btn', () => cb.onTool('putty')),
      box: button(TOOL_LABELS.box, 'kc-btn', () => cb.onTool('box')),
      toy: button(TOOL_LABELS.toy, 'kc-btn', () => cb.onTool('toy')),
      closeDoor: button(TOOL_LABELS.closeDoor, 'kc-btn', () => cb.onTool('closeDoor')),
    };
    this.treatBtn = button('🍗 Treat (2)', 'kc-btn', () => cb.onBuyTreat());
    const undoBtn = button('↶ Undo', 'kc-btn', () => cb.onUndo());
    const releaseBtn = button('Release the Kittens!', 'kc-btn primary', () => cb.onRelease());
    this.prepBar.append(
      this.toolButtons.relocate,
      this.toolButtons.putty,
      this.toolButtons.box,
      this.toolButtons.toy,
      this.toolButtons.closeDoor,
      this.treatBtn,
      sep(),
      undoBtn,
      sep(),
      releaseBtn,
    );
    this.root.appendChild(this.prepBar);

    // Chaos toolbar, pinned to the top so it never covers the room.
    this.chaosBar = el('div', 'kc-bar kc-chaosbar hidden');
    this.timerEl = el('div', 'kc-timer');
    const s1 = button('1x', 'kc-btn active', () => cb.onSpeed(1));
    const s2 = button('2x', 'kc-btn', () => cb.onSpeed(2));
    const skip = button('Skip ⏭', 'kc-btn', () => cb.onSpeed('skip'));
    this.speedButtons = { '1': s1, '2': s2 };
    this.treatDeployBtn = button('🍗 Treat!', 'kc-btn primary', () => cb.onDeployTreat());
    this.treatDeployBtn.style.display = 'none';
    this.chaosBar.append(this.timerEl, sep(), s1, s2, skip, this.treatDeployBtn);
    this.root.appendChild(this.chaosBar);

    // Hover tooltips so help text is available on demand, not always on screen.
    this.tip = el('div', 'kc-tip');
    this.root.appendChild(this.tip);
    for (const key of Object.keys(this.toolButtons) as PrepTool[]) {
      this.attachTip(this.toolButtons[key], TOOL_TIPS[key]);
    }
    this.attachTip(this.treatBtn, 'Buy a treat. During chaos a button calls both kittens to the bowl for 4 seconds. Costs 2.');
    this.attachTip(undoBtn, 'Undo your last action and get the move back.');

    this.banner = el('div', 'kc-banner');
    this.root.appendChild(this.banner);

    this.menu = el('div', 'kc-menu');
    this.root.appendChild(this.menu);

    this.topMenuBtn = button('Menu', 'kc-topmenu hidden', () => cb.onMenu());
    this.root.appendChild(this.topMenuBtn);

    parent.appendChild(this.root);
    this.setActiveTool('relocate');
  }

  /** Show the title / level-select screen with earned stars per level. */
  showMenu(entries: MenuEntry[], onSelect: (index: number) => void): void {
    this.menu.innerHTML = '';
    const h1 = document.createElement('h1');
    h1.textContent = 'Kitten Chaos';
    const sub = el('div', 'sub');
    sub.textContent = 'Pick a room to protect';
    const grid = el('div', 'kc-grid');

    for (const e of entries) {
      const tile = el('button', e.kind === 'endless' ? 'kc-tile endless' : 'kc-tile');
      const name = el('div', 'kc-tile-name');
      name.textContent = e.title;
      tile.appendChild(name);
      if (e.kind === 'endless') {
        const note = el('div', 'kc-tile-note');
        note.textContent = 'Fresh rooms forever';
        tile.appendChild(note);
      } else {
        const s = el('div', 'kc-tile-stars');
        s.innerHTML = [0, 1, 2]
          .map((i) => `<span class="${i < e.stars ? 'kc-star-on' : 'kc-star-off'}">★</span>`)
          .join('');
        tile.appendChild(s);
      }
      tile.addEventListener('click', () => onSelect(e.index));
      grid.appendChild(tile);
    }

    this.menu.append(h1, sub, grid);
    this.menu.classList.add('show');
  }

  hideMenu(): void {
    this.menu.classList.remove('show');
  }

  setTitle(name: string): void {
    this.titleEl.textContent = name;
  }

  setMoves(remaining: number, total: number): void {
    this.movesEl.innerHTML = `Moves left <span class="n">${remaining}</span> / ${total}`;
  }

  /** Show only the actions this level allows. */
  setAvailableTools(actions: ActionName[]): void {
    for (const key of Object.keys(this.toolButtons) as PrepTool[]) {
      this.toolButtons[key].style.display = actions.includes(key) ? '' : 'none';
    }
    this.treatBtn.style.display = actions.includes('treat') ? '' : 'none';
  }

  /** Show a tooltip above an element while the pointer hovers it. */
  private attachTip(target: HTMLElement, text: string): void {
    target.addEventListener('mouseenter', () => {
      const r = target.getBoundingClientRect();
      this.tip.textContent = text;
      this.tip.style.left = `${r.left + r.width / 2}px`;
      this.tip.style.top = `${r.top - 8}px`;
      this.tip.classList.add('show');
    });
    target.addEventListener('mouseleave', () => this.tip.classList.remove('show'));
  }

  setActiveTool(tool: PrepTool): void {
    for (const key of Object.keys(this.toolButtons) as PrepTool[]) {
      this.toolButtons[key].classList.toggle('active', key === tool);
    }
  }

  setTreatPurchased(purchased: boolean): void {
    this.treatBtn.classList.toggle('active', purchased);
  }

  setActiveSpeed(speed: 1 | 2): void {
    for (const key of Object.keys(this.speedButtons)) {
      this.speedButtons[key].classList.toggle('active', key === String(speed));
    }
  }

  setTimer(seconds: number): void {
    const s = Math.max(0, Math.ceil(seconds));
    const cls = s <= 5 ? 'warn' : '';
    this.timerEl.innerHTML = `<span class="${cls}">0:${String(s).padStart(2, '0')}</span>`;
  }

  /** Show (armed) or hide the in-chaos treat deploy button. */
  setTreatArmed(armed: boolean): void {
    this.treatDeployBtn.style.display = armed ? '' : 'none';
    this.treatDeployBtn.disabled = false;
  }

  spendTreat(): void {
    this.treatDeployBtn.disabled = true;
  }

  setPhase(phase: Phase): void {
    this.prepBar.classList.toggle('hidden', phase !== 'prep');
    this.chaosBar.classList.toggle('hidden', phase !== 'chaos');
    this.movesEl.style.display = phase === 'done' || phase === 'menu' ? 'none' : '';
    this.titleEl.style.display = phase === 'menu' ? 'none' : '';
    this.topMenuBtn.classList.toggle('hidden', !(phase === 'prep' || phase === 'chaos'));
    this.tip.classList.remove('show');
    if (phase !== 'done') this.banner.classList.remove('show');
  }

  showResult(
    data: ResultData,
    cb: { onRetry: () => void; onNext: () => void; onMenu: () => void },
  ): void {
    const stars = [0, 1, 2]
      .map((i) => `<span class="${i < data.stars ? 'kc-star-on' : 'kc-star-off'}">★</span>`)
      .join('');

    const incidentsHtml = data.incidents.length
      ? `<ul>${data.incidents
          .map((it) => {
            const icon = it.kind === 'broke' ? '💥' : '↷';
            const verb = it.kind === 'broke' ? 'broke' : 'knocked over';
            const by = it.culprit ? ` by ${it.culprit}` : '';
            return `<li>${icon} ${it.label} ${verb}${by}</li>`;
          })
          .join('')}</ul>`
      : '<div class="ok"><div class="ok-big">Nothing broke!</div><div class="ok-sub">A perfectly civilized evening.</div></div>';

    const bestLine = data.isNewBest
      ? '<div class="kc-newbest">★ New best!</div>'
      : data.best
        ? `<div class="kc-best">Best: ${data.best.score}</div>`
        : '';

    this.banner.innerHTML = `
      <div class="kc-result">
        <h2>${data.levelName}</h2>
        <div class="kc-stars">${stars}</div>
        <div class="kc-score">Score ${data.score}</div>
        <div class="kc-best">Saved ${Math.round(data.survivedValue)} of ${data.totalValue}, +${data.moveBonus} move bonus</div>
        ${bestLine}
        <div class="kc-incidents">${incidentsHtml}</div>
      </div>`;

    const btns = el('div', 'kc-result-btns');
    const menuBtn = button('Menu', 'kc-btn', cb.onMenu);
    const retry = button('↺ Retry', 'kc-btn', cb.onRetry);
    const next = button('Next', 'kc-btn primary', cb.onNext);
    if (!data.hasNext) next.disabled = true;
    btns.append(menuBtn, retry, next);
    this.banner.querySelector('.kc-result')?.appendChild(btns);
    this.banner.classList.add('show');
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className);
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function sep(): HTMLDivElement {
  return el('div', 'kc-sep');
}
