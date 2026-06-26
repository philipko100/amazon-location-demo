/**
 * Browser stub for @aws-sdk/credential-provider-node.
 *
 * The Node default-credential chain (env/INI/SSO/IMDS/process/login) pulls in
 * node:fs/os/path/crypto, which cannot be bundled for the browser. This app
 * always constructs its AWS SDK clients with EXPLICIT Cognito credentials
 * (see services/auth.ts), so that chain is never invoked. Aliasing the package
 * to this stub (vite.config.ts) cuts the Node-only imports out of the bundle.
 *
 * If anything ever does call defaultProvider() in the browser, failing loudly
 * is the correct behavior — credentials must come from Cognito.
 */
export function defaultProvider(): never {
  throw new Error(
    "defaultProvider() is not available in the browser. " +
      "AWS clients must be created with explicit Cognito credentials.",
  );
}

export const credentialsTreatedAsExpired = () => false;
export const credentialsWillNeedRefresh = () => false;
