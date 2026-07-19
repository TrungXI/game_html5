export interface IGameSDK {
  /**
   * Optional async setup — awaited in BootScene before the game continues.
   * Real portal SDKs (e.g. CrazyGames) init asynchronously; NoopSDK omits it.
   */
  init?(): Promise<void>;
  /** Call once, as loading begins (in PreloadScene start). */
  gameLoadingStart(): void;
  /** Call once, when all assets are loaded (PreloadScene complete). */
  gameLoadingFinished(): void;
  /** Call when an actual run begins (GameScene start of play). */
  gameplayStart(): void;
  /** Call when a run ends / pauses (game over, or leaving gameplay). */
  gameplayStop(): void;
  /** Show a rewarded ad. Resolves true if the reward was granted. */
  showRewarded(): Promise<boolean>;
  /** Show an interstitial ad. Resolves when the ad flow completes. */
  showInterstitial(): Promise<void>;
}
