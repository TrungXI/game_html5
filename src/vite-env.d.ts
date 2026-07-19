// Typing for the build-time env we read. tsconfig uses `types: []`, so we
// declare only what we use rather than pulling in all of `vite/client`.
interface ImportMetaEnv {
  /** Portal SDK provider chosen at build time, e.g. "crazygames". */
  readonly VITE_SDK_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
