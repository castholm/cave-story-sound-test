import { defineConfig } from "vite"

export default defineConfig({
  root: "src/",
  publicDir: false,
  assetsInclude: ["**/data/**"],
  build: {
    target: "esnext",
    polyfillModulePreload: false,
    outDir: "../dst/",
    emptyOutDir: true,
  },
})
