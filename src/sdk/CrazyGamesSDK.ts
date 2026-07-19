import type { IGameSDK } from "./IGameSDK";

/**
 * Minimal shape of the CrazyGames SDK v3 surface we use. The full SDK exposes
 * far more; we type only what this wrapper touches.
 *
 * API confirmed against https://docs.crazygames.com/sdk/ (v3):
 *   init()                    → https://docs.crazygames.com/sdk/intro/
 *   game.loadingStart/Stop()  → https://docs.crazygames.com/sdk/game/
 *   game.gameplayStart/Stop() → https://docs.crazygames.com/sdk/game/
 *   ad.requestAd(type, cbs)   → https://docs.crazygames.com/sdk/video-ads/
 */
const SDK_SCRIPT_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
interface CrazyAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

interface CrazyGamesSDKv3 {
  init(): Promise<void>;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
  };
  ad: {
    requestAd(type: "midgame" | "rewarded", callbacks: CrazyAdCallbacks): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSDKv3 };
  }
}

/**
 * Real CrazyGames portal SDK (v3). Every method is guarded: outside the portal
 * (local dev, missing script) `window.CrazyGames` is undefined, so calls degrade
 * to a console.warn no-op and ad promises resolve safely — never throw, never
 * reject the game loop.
 */
export class CrazyGamesSDK implements IGameSDK {
  private get sdk(): CrazyGamesSDKv3 | undefined {
    return window.CrazyGames?.SDK;
  }

  async init(): Promise<void> {
    try {
      await this.loadScript();
    } catch (error) {
      // Outside the portal the CDN script is unreachable — that's expected;
      // stay a silent-ish no-op so the game still runs.
      console.warn("[CrazyGamesSDK] SDK script unavailable — running as no-op.", error);
      return;
    }
    const sdk = this.sdk;
    if (!sdk) {
      console.warn("[CrazyGamesSDK] window.CrazyGames absent — running as no-op.");
      return;
    }
    try {
      await sdk.init();
    } catch (error) {
      console.warn("[CrazyGamesSDK] init failed — degrading to no-op.", error);
    }
  }

  /** Inject the SDK v3 <script> once. Resolves when loaded, rejects on error. */
  private loadScript(): Promise<void> {
    if (window.CrazyGames) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${SDK_SCRIPT_URL}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("script error")));
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("script error"));
      document.head.appendChild(script);
    });
  }

  gameLoadingStart(): void {
    this.sdk?.game.loadingStart();
  }

  gameLoadingFinished(): void {
    this.sdk?.game.loadingStop();
  }

  gameplayStart(): void {
    this.sdk?.game.gameplayStart();
  }

  gameplayStop(): void {
    this.sdk?.game.gameplayStop();
  }

  /** Rewarded ad — resolves true only when the ad completes (reward earned). */
  showRewarded(): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) {
      console.warn("[CrazyGamesSDK] showRewarded no-op (SDK absent).");
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      sdk.ad.requestAd("rewarded", {
        adFinished: () => resolve(true),
        adError: (error) => {
          console.warn("[CrazyGamesSDK] rewarded ad error.", error);
          resolve(false);
        },
      });
    });
  }

  /** Interstitial ad — always resolves (finish OR error) so the loop never stalls. */
  showInterstitial(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) {
      console.warn("[CrazyGamesSDK] showInterstitial no-op (SDK absent).");
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      sdk.ad.requestAd("midgame", {
        adFinished: () => resolve(),
        adError: (error) => {
          console.warn("[CrazyGamesSDK] midgame ad error.", error);
          resolve();
        },
      });
    });
  }
}
