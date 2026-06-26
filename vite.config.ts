import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// parquet-wasm ships a WASM module; vite-plugin-wasm + top-level-await let it
// load cleanly in the browser without manual fetch/instantiate glue.
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      // The AWS SDK clients statically import the Node default-credential chain
      // (node:fs/os/path/crypto), which can't bundle for the browser. We always
      // supply explicit Cognito credentials, so alias it to a no-op stub.
      "@aws-sdk/credential-provider-node": fileURLToPath(
        new URL("./src/stubs/credential-provider-node.ts", import.meta.url),
      ),
      // The credential-providers barrel `export *`s Node-only providers
      // (fromIni/fromLoginCredentials/SSO). The auth helper only needs the
      // browser-safe Cognito provider — re-export just that.
      "@aws-sdk/credential-providers": fileURLToPath(
        new URL("./src/stubs/credential-providers.ts", import.meta.url),
      ),
    },
  },
  server: { port: 5173 },
  // parquet-wasm and apache-arrow are heavy; keep them out of the eager dep
  // optimization pass so dev startup stays fast (they load on first use).
  optimizeDeps: {
    exclude: ["parquet-wasm"],
  },
});
