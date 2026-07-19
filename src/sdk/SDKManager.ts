import type { IGameSDK } from "./IGameSDK";
import { NoopSDK } from "./NoopSDK";
import { CrazyGamesSDK } from "./CrazyGamesSDK";
import { SDK_PROVIDER } from "../config/constants";

export type { IGameSDK } from "./IGameSDK";

/**
 * Single seam for portal integration. The provider is chosen from
 * `VITE_SDK_PROVIDER` (build-time env) with the `SDK_PROVIDER` constant as
 * fallback — so local `npm run dev` uses NoopSDK, while a portal build runs
 * `VITE_SDK_PROVIDER=crazygames npm run build`.
 */
export function createSDK(
  provider: string = import.meta.env.VITE_SDK_PROVIDER ?? SDK_PROVIDER,
): IGameSDK {
  switch (provider) {
    case "crazygames":
      // The v3 loader <script> lives in index.html; it only resolves inside the
      // CrazyGames portal. Outside it, CrazyGamesSDK degrades to a safe no-op.
      return new CrazyGamesSDK();
    // case "poki":
    //   // 1. Add <script src="//game-cdn.poki.com/scripts/v2/poki-sdk.js"></script> to index.html
    //   // 2. Implement PokiSDK wrapping window.PokiSDK:
    //   //      gameplayStart()  -> PokiSDK.gameplayStart()
    //   //      gameplayStop()   -> PokiSDK.gameplayStop()
    //   //      showRewarded()   -> PokiSDK.rewardedBreak()   (resolves boolean)
    //   //      showInterstitial()-> PokiSDK.commercialBreak()
    //   //   Call PokiSDK.init() BEFORE returning; gate on its promise in Boot.
    //   return new PokiSDK();
    default:
      return new NoopSDK();
  }
}
