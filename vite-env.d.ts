/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID: string;
  readonly VITE_COGNITO_UNAUTH_ROLE_ARN: string;
  readonly VITE_MAP_NAME: string;
  readonly VITE_MAP_NAME_DARK?: string;
  readonly VITE_VALIDATION_BUCKET: string;
  readonly VITE_JOBS_EXECUTION_ROLE_ARN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
