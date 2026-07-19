import Phaser from "phaser";
import {
  COLOR,
  GAME_WIDTH,
  MEMORY_CARD_BACK,
  MEMORY_CARD_FACE,
  MEMORY_COLS,
  MEMORY_MISMATCH_DELAY,
  MEMORY_ROWS,
  MEMORY_SCORE_BASE,
  MEMORY_SCORE_PER_MOVE,
  MEMORY_SYMBOLS,
} from "../config/constants";
import type { GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

const CARD_COUNT = MEMORY_COLS * MEMORY_ROWS;
const GRID_TOP = 300;
const CARD_GAP = 20;

/** One card slot: its symbol id (0..pairs-1), face graphics, and flip state. */
interface Card {
  symbol: number;
  bg: Phaser.GameObjects.Rectangle; // the tappable face-down back
  face: Phaser.GameObjects.Container; // the drawn symbol, shown when face-up
  faceUp: boolean;
  matched: boolean;
}

/**
 * "Memory Match" — a 4×4 grid of face-down cards (8 pairs). Flip two: a match
 * stays up, a mismatch flips back after a beat. Win when every pair is matched.
 * Score rewards fewer moves. Every face is a Graphics/Text symbol — zero art
 * files. Playable by pointer and keyboard (arrows to move, Enter/Space to flip).
 * No checkpoint (opted out per SPEC).
 */
export class MemoryScene extends Phaser.Scene {
  private readonly gameId: GameId = "memory";

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private cards: Card[] = [];
  private first: number | null = null; // index of the first flipped card, if any
  private locked = false; // ignore input during the mismatch flip-back delay
  private moves = 0;
  private matchedPairs = 0;
  private cursor = 0; // keyboard-selected card index
  private isOver = false;

  private movesText!: Phaser.GameObjects.Text;
  private cardWidth = 0;
  private cardHeight = 0;

  constructor() {
    super("Memory");
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.cards = [];
    this.first = null;
    this.locked = false;
    this.moves = 0;
    this.matchedPairs = 0;
    this.cursor = 0;
    this.isOver = false;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);

    this.cardWidth = (GAME_WIDTH - CARD_GAP * (MEMORY_COLS + 1)) / MEMORY_COLS;
    this.cardHeight = this.cardWidth; // square cards

    this.createHud();
    this.buildDeck();
    this.bindInput();
    this.highlight();

    this.sdk.gameplayStart();
  }

  private createHud(): void {
    this.add
      .text(GAME_WIDTH / 2, 60, "MEMORY", {
        color: COLOR.accent,
        fontSize: "60px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.movesText = this.add
      .text(GAME_WIDTH / 2, 150, "MOVES: 0", {
        color: COLOR.text,
        fontSize: "40px",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 210, `BEST: ${SaveSystem.getHighScore(this.gameId)}`, {
        color: COLOR.accent,
        fontSize: "28px",
      })
      .setOrigin(0.5, 0);
  }

  /** Build a shuffled deck of symbol pairs, one Card per grid slot. */
  private buildDeck(): void {
    const pairs = CARD_COUNT / 2;
    const ids: number[] = [];
    for (let i = 0; i < pairs; i++) ids.push(i, i);
    Phaser.Utils.Array.Shuffle(ids);

    ids.forEach((symbol, index) => this.createCard(symbol, index));
  }

  private createCard(symbol: number, index: number): void {
    const col = index % MEMORY_COLS;
    const row = Math.floor(index / MEMORY_COLS);
    const x = CARD_GAP + col * (this.cardWidth + CARD_GAP);
    const y = GRID_TOP + row * (this.cardHeight + CARD_GAP);
    const cx = x + this.cardWidth / 2;
    const cy = y + this.cardHeight / 2;

    // Face container (symbol), drawn hidden beneath the face-down back.
    const face = this.add.container(cx, cy);
    face.add(
      this.add.rectangle(0, 0, this.cardWidth, this.cardHeight, MEMORY_CARD_FACE),
    );
    face.add(this.drawSymbol(symbol));
    face.setVisible(false);

    const bg = this.add
      .rectangle(cx, cy, this.cardWidth, this.cardHeight, MEMORY_CARD_BACK)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.cursor = index;
      this.flip(index);
    });

    this.cards.push({ symbol, bg, face, faceUp: false, matched: false });
  }

  /** Draw a pair's identity — a colored shape — with Graphics (no art files). */
  private drawSymbol(symbol: number): Phaser.GameObjects.Graphics {
    const def = MEMORY_SYMBOLS[symbol];
    const g = this.add.graphics();
    const rad = this.cardWidth * 0.28;
    g.fillStyle(def.color, 1);
    switch (def.shape) {
      case "circle":
        g.fillCircle(0, 0, rad);
        break;
      case "square":
        g.fillRect(-rad, -rad, rad * 2, rad * 2);
        break;
      case "triangle":
        g.fillTriangle(0, -rad, rad, rad, -rad, rad);
        break;
      case "diamond":
        g.fillPoints(
          [
            new Phaser.Geom.Point(0, -rad),
            new Phaser.Geom.Point(rad, 0),
            new Phaser.Geom.Point(0, rad),
            new Phaser.Geom.Point(-rad, 0),
          ],
          true,
        );
        break;
    }
    return g;
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on("keydown-LEFT", () => this.moveCursor(-1));
    kb.on("keydown-RIGHT", () => this.moveCursor(1));
    kb.on("keydown-UP", () => this.moveCursor(-MEMORY_COLS));
    kb.on("keydown-DOWN", () => this.moveCursor(MEMORY_COLS));
    kb.on("keydown-ENTER", () => this.flip(this.cursor));
    kb.on("keydown-SPACE", () => this.flip(this.cursor));
  }

  private moveCursor(delta: number): void {
    this.cursor = Phaser.Math.Wrap(this.cursor + delta, 0, CARD_COUNT);
    this.highlight();
  }

  /** Outline the keyboard-selected card so arrow navigation reads clearly. */
  private highlight(): void {
    this.cards.forEach((card, i) => {
      const active = i === this.cursor && !card.matched;
      card.bg.setStrokeStyle(active ? 6 : 0, COLOR.player);
    });
  }

  /** Flip a card face-up; resolve a pair once two are showing. */
  private flip(index: number): void {
    if (this.isOver || this.locked) return;
    const card = this.cards[index];
    if (card.matched || card.faceUp) return;

    this.reveal(card, true);
    this.audio.play("flip");

    if (this.first === null) {
      this.first = index;
      return;
    }

    // Second card of the move.
    this.moves += 1;
    this.movesText.setText(`MOVES: ${this.moves}`);
    const firstCard = this.cards[this.first];

    if (firstCard.symbol === card.symbol) {
      firstCard.matched = true;
      card.matched = true;
      this.first = null;
      this.matchedPairs += 1;
      this.audio.play("match");
      firstCard.bg.setStrokeStyle(0);
      card.bg.setStrokeStyle(0);
      if (this.matchedPairs === CARD_COUNT / 2) this.endRun();
    } else {
      // Mismatch — briefly show both, then flip back.
      this.locked = true;
      const other = this.first;
      this.first = null;
      this.time.delayedCall(MEMORY_MISMATCH_DELAY, () => {
        this.reveal(firstCard, false);
        this.reveal(card, false);
        this.locked = false;
        this.highlight();
        // Play flip only after control returns, avoids overlapping the match sound.
        if (other !== null) this.audio.play("flip");
      });
    }
  }

  /** Toggle a card's face visibility (back hidden when face-up). */
  private reveal(card: Card, faceUp: boolean): void {
    card.faceUp = faceUp;
    card.face.setVisible(faceUp);
    card.bg.setVisible(!faceUp);
  }

  /** Score = base minus a penalty per move over the perfect minimum, floored at 10. */
  private computeScore(): number {
    const minMoves = CARD_COUNT / 2; // one move per pair is a flawless game
    const extra = Math.max(0, this.moves - minMoves);
    return Math.max(10, MEMORY_SCORE_BASE - extra * MEMORY_SCORE_PER_MOVE);
  }

  private endRun(): void {
    if (this.isOver) return;
    this.isOver = true;
    const score = this.computeScore();
    this.audio.play("levelup");

    this.sdk.gameplayStop();
    const isNewBest = SaveSystem.submitScore(this.gameId, score);
    RankSystem.addXP(this.gameId, score);
    const highScore = SaveSystem.getHighScore(this.gameId);

    void this.sdk.showInterstitial().then(() => {
      this.scene.start("GameOver", {
        gameId: this.gameId,
        score,
        highScore,
        isNewBest,
      });
    });
  }
}
