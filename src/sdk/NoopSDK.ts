import type { IGameSDK } from "./IGameSDK";

/**
 * Default SDK implementation used in dev / standalone.
 * Logs every call and never touches the network. `showRewarded()` grants the
 * reward so the "continue?" flow is exercisable without a real portal.
 */
export class NoopSDK implements IGameSDK {
  gameLoadingStart(): void {
    console.log("[NoopSDK] gameLoadingStart");
  }
  gameLoadingFinished(): void {
    console.log("[NoopSDK] gameLoadingFinished");
  }
  gameplayStart(): void {
    console.log("[NoopSDK] gameplayStart");
  }
  gameplayStop(): void {
    console.log("[NoopSDK] gameplayStop");
  }
  async showRewarded(): Promise<boolean> {
    console.log("[NoopSDK] showRewarded → granting reward (dev)");
    return true;
  }
  async showInterstitial(): Promise<void> {
    console.log("[NoopSDK] showInterstitial → resolved (dev)");
  }
}
