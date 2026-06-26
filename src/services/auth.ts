/**
 * Single Cognito-backed credential source for the entire app.
 *
 * Why the CLASSIC (basic) Cognito flow, not the enhanced flow:
 * The enhanced flow (GetCredentialsForIdentity, which the AWS SDK's
 * fromCognitoIdentityPool uses) attaches a Cognito-managed *session policy* to
 * the vended credentials. Effective permissions are the intersection of the
 * role's policy AND that session policy — and Cognito's session policy omits
 * iam:PassRole. That breaks the Jobs StartJob call ("no session policy allows
 * the iam:PassRole action"), and the session policy isn't editable.
 *
 * The classic flow (GetId -> GetOpenIdToken -> AssumeRoleWithWebIdentity)
 * assumes the unauth role directly via STS with NO Cognito session policy, so
 * the role's identity policy (which grants iam:PassRole) fully applies.
 *
 * The amazon-location-utilities-auth-helper's buildAuthHelper() turns any
 * credential provider into the helper the rest of the app already uses:
 *   - getMapAuthenticationOptions() -> { transformRequest } for MapLibre
 *   - getClientConfig()             -> { credentials } for AWS SDK v3 clients
 */
import {
  withCredentialProvider,
  type MapAuthHelper,
  type SDKAuthHelper,
} from "@aws/amazon-location-utilities-auth-helper";
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetOpenIdTokenCommand,
} from "@aws-sdk/client-cognito-identity";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import type { AwsCredentialIdentity } from "@aws-sdk/types";
import {
  AWS_REGION,
  COGNITO_IDENTITY_POOL_ID,
  COGNITO_UNAUTH_ROLE_ARN,
} from "../config/aws";

export type LocationAuthHelper = MapAuthHelper & SDKAuthHelper;

// These three operations are all unauthenticated (no SigV4), so the clients
// need no credentials of their own.
const cognito = new CognitoIdentityClient({ region: AWS_REGION });
const sts = new STSClient({ region: AWS_REGION });

let cachedIdentityId: string | null = null;
let current: AwsCredentialIdentity | null = null;

/**
 * Run the classic Cognito flow and return temporary credentials for the unauth
 * role. GetId is cached across calls; the token + AssumeRole steps run each
 * time credentials need (re)issuing.
 */
async function fetchCredentials(): Promise<AwsCredentialIdentity> {
  if (!cachedIdentityId) {
    const { IdentityId } = await cognito.send(
      new GetIdCommand({ IdentityPoolId: COGNITO_IDENTITY_POOL_ID }),
    );
    if (!IdentityId) throw new Error("Cognito GetId returned no IdentityId.");
    cachedIdentityId = IdentityId;
  }

  const { Token } = await cognito.send(
    new GetOpenIdTokenCommand({ IdentityId: cachedIdentityId }),
  );
  if (!Token) throw new Error("Cognito GetOpenIdToken returned no Token.");

  const { Credentials } = await sts.send(
    new AssumeRoleWithWebIdentityCommand({
      RoleArn: COGNITO_UNAUTH_ROLE_ARN,
      RoleSessionName: "amazon-location-demo",
      WebIdentityToken: Token,
      DurationSeconds: 3600,
    }),
  );
  if (!Credentials?.AccessKeyId || !Credentials.SecretAccessKey) {
    throw new Error("AssumeRoleWithWebIdentity returned no credentials.");
  }

  return {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretAccessKey,
    sessionToken: Credentials.SessionToken,
    expiration: Credentials.Expiration,
  };
}

/**
 * Credential provider compatible with AWS SDK v3 + the auth helper. Re-runs the
 * classic flow when there are no credentials yet or they're within 5 minutes of
 * expiry.
 */
const credentialProvider = async (): Promise<AwsCredentialIdentity> => {
  const skewMs = 5 * 60 * 1000;
  const expired =
    !current ||
    (current.expiration && current.expiration.getTime() - Date.now() < skewMs);
  if (expired) current = await fetchCredentials();
  return current!;
};

let authHelperPromise: Promise<LocationAuthHelper> | null = null;

/** Memoized auth helper built on the classic-flow credential provider. */
export function getAuthHelper(): Promise<LocationAuthHelper> {
  if (!authHelperPromise) {
    authHelperPromise = withCredentialProvider(credentialProvider, AWS_REGION);
  }
  return authHelperPromise;
}

/**
 * Raw temporary credentials for SigV4 signing (used where a panel needs them
 * directly). Always returns fresh-enough credentials via the provider.
 */
export async function resolveCredentials(): Promise<AwsCredentialIdentity> {
  return credentialProvider();
}
