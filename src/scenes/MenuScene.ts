import Phaser from "phaser";
import {
  CARD_COLOR,
  CARD_COLOR_ACTIVE,
  COLOR,
  GAME_ACCENTS,
  GAME_HEIGHT,
  GAME_WIDTH,
} from "../config/constants";
import { GAMES, type GameMeta } from "../config/games";
import { AudioManager } from "../systems/AudioManager";
import { CheckpointSystem } from "../systems/CheckpointSystem";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

const COLS = 2;
const CARD_GAP = 40;
const CARD_HEIGHT = 240;
const GRID_TOP = 300;

/** A rendered card: its background rect and the two tappable zones' bounds. */
interface Card {
  bg: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  best: Phaser.GameObjects.Text;
  continueBadge: Phaser.GameObjects.Text | null;
}

/**
 * Game-select: a data-driven 2-column card grid over GAMES, a rank/XP banner on
 * top, and a per-game "CONTINUE" affordance for games with a saved checkpoint.
 * Fully playable by pointer (tap card = New Game; tap Continue badge = resume)
 * and keyboard (arrows / number keys / Enter / Space / C). The grid lives in a
 * Container that scrolls, so it holds any number of games (6 today).
 */
export class MenuScene extends Phaser.Scene {
  private cards: Card[] = [];
  private grid!: Phaser.GameObjects.Container;
  private selected = 0;
  private muteBtn!: Phaser.GameObjects.Text;
  private audio!: AudioManager;

  private cardWidth = 0;
  private viewTop = 0; // top of the scrollable viewport (world y)
  private viewBottom = 0;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.cards = [];
    this.selected = 0;
    this.audio = new AudioManager(this);

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 60, "ARCADE", {
        color: COLOR.accent,
        fontSize: "72px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.createRankBanner();
    this.createMuteButton();

    // Viewport for the (potentially scrolling) grid: from GRID_TOP to the hint.
    this.viewTop = GRID_TOP;
    this.viewBottom = GAME_HEIGHT - 160;
    this.cardWidth = (GAME_WIDTH - CARD_GAP * (COLS + 1)) / COLS;

    this.grid = this.add.container(0, 0);
    GAMES.forEach((game, i) => this.createCard(game, i));

    this.add
      .text(cx, GAME_HEIGHT - 90, "TAP · ←→↑↓ MOVE · ENTER/SPACE PLAY · C CONTINUE", {
        color: COLOR.accent,
        fontSize: "26px",
      })
      .setOrigin(0.5);

    this.bindKeyboard();
    this.bindScroll();
    this.highlight();
  }

  /** Rank tier title + a progress bar (track + fill) tinted with the tier color. */
  private createRankBanner(): void {
    const p = RankSystem.getProgressToNext();
    const barW = GAME_WIDTH - 120;
    const barH = 36;
    const barX = 60;
    const barY = 190;

    this.add
      .text(barX, 150, p.current.title, {
        color: hex(p.current.color),
        fontSize: "40px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const label =
      p.next === null ? "MAX" : `${p.xpIntoTier} / ${p.xpForTier} XP`;
    this.add
      .text(GAME_WIDTH - 60, 150, label, {
        color: COLOR.accent,
        fontSize: "32px",
      })
      .setOrigin(1, 0);

    // Track then fill; fill width scales by the tier progress ratio.
    this.add.rectangle(barX, barY, barW, barH, CARD_COLOR).setOrigin(0, 0);
    this.add
      .rectangle(barX, barY, Math.max(0, barW * p.ratio), barH, p.current.color)
      .setOrigin(0, 0);
  }

  /**
   * A speaker glyph in the top-right corner (no art file — a Unicode symbol).
   * Pointer tap or the 'M' key toggles the persisted mute flag and re-labels it.
   */
  private createMuteButton(): void {
    this.muteBtn = this.add
      .text(GAME_WIDTH - 20, 20, this.muteLabel(), {
        color: COLOR.accent,
        fontSize: "44px",
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on("pointerdown", (
      _p: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.toggleMute();
    });
    this.input.keyboard?.on("keydown-M", () => this.toggleMute());
  }

  private muteLabel(): string {
    return AudioManager.isMuted() ? "SOUND: OFF" : "SOUND: ON";
  }

  private toggleMute(): void {
    const nowMuted = AudioManager.toggleMute();
    this.muteBtn.setText(this.muteLabel());
    if (!nowMuted) this.audio.play("click"); // audible confirm only when unmuting
  }

  /**
   * A single game card. Two tap zones (documented): the card body starts a New
   * Game; when a checkpoint exists, a "CONTINUE" badge overlays the lower card
   * and its own tap starts a resume instead. Keyboard C also resumes.
   */
  private createCard(game: GameMeta, index: number): void {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = CARD_GAP + col * (this.cardWidth + CARD_GAP);
    const y = this.viewTop + row * (CARD_HEIGHT + CARD_GAP);
    const cxCard = x + this.cardWidth / 2;

    const bg = this.add
      .rectangle(x, y, this.cardWidth, CARD_HEIGHT, CARD_COLOR)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => {
      this.selected = index;
      this.highlight();
    });
    // Tap the card body → New Game (fresh run wipes any stale checkpoint).
    bg.on("pointerdown", () => this.startNew(game));

    // A thin accent strip along the card top so each game reads at a glance.
    // Drawn over the card body (added to grid after bg below).
    const accent = GAME_ACCENTS[game.id] ?? CARD_COLOR_ACTIVE;
    const accentStrip = this.add
      .rectangle(x, y, this.cardWidth, 10, accent)
      .setOrigin(0, 0);

    const title = this.add
      .text(cxCard, y + 60, game.title, {
        color: COLOR.text,
        fontSize: "40px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const best = this.add
      .text(cxCard, y + 120, `BEST: ${SaveSystem.getHighScore(game.id)}`, {
        color: COLOR.accent,
        fontSize: "28px",
      })
      .setOrigin(0.5);

    let continueBadge: Phaser.GameObjects.Text | null = null;
    if (game.supportsCheckpoint && CheckpointSystem.has(game.id)) {
      continueBadge = this.add
        .text(cxCard, y + CARD_HEIGHT - 44, "▸ CONTINUE", {
          color: "#06d6a0",
          fontSize: "28px",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      // Tapping the badge resumes; it sits above the card body so it wins the hit.
      continueBadge.on("pointerdown", (
        _p: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.startContinue(game);
      });
    }

    this.grid.add(bg);
    this.grid.add(accentStrip);
    this.grid.add(title);
    this.grid.add(best);
    if (continueBadge) this.grid.add(continueBadge);

    this.cards.push({ bg, title, best, continueBadge });
  }

  private bindKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    kb.on("keydown-LEFT", () => this.move(-1));
    kb.on("keydown-RIGHT", () => this.move(1));
    kb.on("keydown-UP", () => this.move(-COLS));
    kb.on("keydown-DOWN", () => this.move(COLS));
    kb.on("keydown-ENTER", () => this.startNew(GAMES[this.selected]));
    kb.on("keydown-SPACE", () => this.startNew(GAMES[this.selected]));
    kb.on("keydown-C", () => {
      const game = GAMES[this.selected];
      if (game.supportsCheckpoint && CheckpointSystem.has(game.id)) {
        this.startContinue(game);
      }
    });

    // Number keys 1..9 pick that game directly and start it. Phaser names digit
    // keys with spelled-out words (keydown-ONE..NINE), not the numeric string.
    const DIGIT_NAMES = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    GAMES.forEach((game, i) => {
      if (i < DIGIT_NAMES.length) {
        kb.on(`keydown-${DIGIT_NAMES[i]}`, () => this.startNew(game));
      }
    });
  }

  /** Wheel + arrow-driven scroll so a selection off-screen scrolls into view. */
  private bindScroll(): void {
    this.input.on(
      "wheel",
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.scrollBy(-dy);
      },
    );
  }

  private move(delta: number): void {
    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, GAMES.length);
    this.highlight();
    this.ensureVisible();
  }

  private scrollBy(dy: number): void {
    const gridHeight = Math.ceil(GAMES.length / COLS) * (CARD_HEIGHT + CARD_GAP);
    const overflow = gridHeight - (this.viewBottom - this.viewTop);
    if (overflow <= 0) return; // everything fits — no scroll
    this.grid.y = Phaser.Math.Clamp(this.grid.y + dy, -overflow, 0);
  }

  /** Scroll so the selected card's row is fully inside the viewport. */
  private ensureVisible(): void {
    const row = Math.floor(this.selected / COLS);
    const cardTop = this.viewTop + row * (CARD_HEIGHT + CARD_GAP) + this.grid.y;
    const cardBottom = cardTop + CARD_HEIGHT;
    if (cardTop < this.viewTop) this.scrollBy(this.viewTop - cardTop);
    else if (cardBottom > this.viewBottom) this.scrollBy(this.viewBottom - cardBottom);
  }

  private highlight(): void {
    this.cards.forEach((card, i) => {
      const active = i === this.selected;
      card.bg.setFillStyle(active ? CARD_COLOR_ACTIVE : CARD_COLOR);
      card.title.setColor(active ? hex(COLOR.bg) : COLOR.text);
      card.best.setColor(active ? hex(COLOR.bg) : COLOR.accent);
    });
  }

  private startNew(game: GameMeta): void {
    this.audio.play("click");
    if (game.supportsCheckpoint) CheckpointSystem.clear(game.id); // fresh run wipes stale save
    this.scene.start(game.sceneKey, { gameId: game.id });
  }

  private startContinue(game: GameMeta): void {
    this.scene.start(game.sceneKey, { gameId: game.id, resume: true });
  }
}

/** Phaser numeric hex → CSS "#rrggbb" for Text.setColor. */
function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
