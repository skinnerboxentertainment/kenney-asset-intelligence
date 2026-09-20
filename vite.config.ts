import { defineConfig } from "vite"
import { assetsApi } from "./tools/vite-plugin-assets.mjs"

export default defineConfig({
  root: ".",
  plugins: [assetsApi()],
  server: {
    proxy: {
      "/kenney-zip": {
        target: "https://kenney.nl",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kenney-zip/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
})
