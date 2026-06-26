/**
 * Browser stub for the @aws-sdk/credential-providers barrel.
 *
 * The real barrel does `export *` over fromIni / fromLoginCredentials / SSO /
 * process providers, all of which statically import node:fs/os/path/crypto and
 * therefore can't bundle for the browser. The amazon-location auth helper only
 * uses fromCognitoIdentityPool, which lives in a browser-safe sub-package — so
 * we re-export just that one and drop the Node-only branches (vite.config.ts
 * aliases the barrel here).
 */
export { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
