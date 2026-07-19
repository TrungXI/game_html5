import Phaser from "phaser";
import { COLOR, GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { GAMES, type GameMeta } from "../config/games";
import { SaveSystem } from "../systems/SaveSystem";

/** Game-select: one button per registered game, choosable by tap or keyboard. */
export class MenuScene extends Phaser.Scene {
  private buttons: Phaser.GameObjects.Text[] = [];
  private selected = 0;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.buttons = [];
    this.selected = 0;

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 240, "ARCADE", {
        color: COLOR.accent,
        fontSize: "96px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 340, "PICK A GAME", {
        color: COLOR.text,
        fontSize: "40px",
      })
      .setOrigin(0.5);

    GAMES.forEach((game, i) => this.createButton(game, i, cx, 520 + i * 200));

    this.add
      .text(cx, GAME_HEIGHT - 120, "TAP A GAME · ↑↓ + SPACE · 1-9", {
        color: COLOR.accent,
        fontSize: "30px",
      })
      .setOrigin(0.5);

    this.bindKeyboard();
    this.highlight();
  }

  private createButton(game: GameMeta, index: number, x: number, y: number): void {
    const best = SaveSystem.getHighScore(game.id);
    const btn = this.add
      .text(x, y, `${index + 1}. ${game.title}\nBEST: ${best}`, {
        color: COLOR.text,
        fontSize: "48px",
        fontStyle: "bold",
        align: "center",
        backgroundColor: "#2e3f52",
        padding: { x: 40, y: 24 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => {
      this.selected = index;
      this.highlight();
    });
    btn.on("pointerdown", () => this.start(game));

    this.buttons.push(btn);
  }

  private bindKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    kb.on("keydown-SPACE", () => this.start(GAMES[this.selected]));
    kb.on("keydown-ENTER", () => this.start(GAMES[this.selected]));

    // Number keys 1..9 pick that game directly.
    GAMES.forEach((game, i) => {
      kb.on(`keydown-${(i + 1) as unknown as string}`, () => this.start(game));
    });
  }

  private move(delta: number): void {
    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, GAMES.length);
    this.highlight();
  }

  private highlight(): void {
    this.buttons.forEach((btn, i) => {
      const active = i === this.selected;
      btn.setBackgroundColor(active ? "#4fc3f7" : "#2e3f52");
      btn.setColor(active ? "#1b2838" : COLOR.text);
    });
  }

  private start(game: GameMeta): void {
    this.scene.start(game.sceneKey, { gameId: game.id });
  }
}
