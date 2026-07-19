import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // relative paths — required by most portals' zip upload
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});
