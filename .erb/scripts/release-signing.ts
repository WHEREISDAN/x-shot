/**
 * Decides, from the secrets present, whether a release build is signed and
 * notarized, and says so in the log. The publish workflow runs this before
 * electron-builder; without a certificate it keeps the build unsigned by
 * writing CSC_IDENTITY_AUTO_DISCOVERY=false to $GITHUB_ENV.
 */
import fs from 'fs';

type Env = Record<string, string | undefined>;

export interface SigningPlan {
  sign: boolean;
  notarize: boolean;
  /** Log lines explaining the decision. */
  messages: string[];
  /** Variables the following workflow steps need. */
  env: Record<string, string>;
  /** Set when the secrets are only partly configured. */
  error?: string;
}

const APPLE_NOTARY = [
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
] as const;

const isSet = (env: Env, name: string) => (env[name] ?? '').trim() !== '';

function certificate(env: Env, link: string, password: string) {
  const present = [link, password].filter((name) => isSet(env, name));
  return {
    complete: present.length === 2,
    partial: present.length === 1,
  };
}

const unsigned = (messages: string[]): SigningPlan => ({
  sign: false,
  notarize: false,
  messages,
  env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});

function planMac(env: Env): SigningPlan {
  const cert = certificate(env, 'CSC_LINK', 'CSC_KEY_PASSWORD');
  const notary = APPLE_NOTARY.filter((name) => isSet(env, name));
  if (cert.partial) {
    return {
      ...unsigned([]),
      error: 'macOS signing needs both CSC_LINK and CSC_KEY_PASSWORD.',
    };
  }
  if (!cert.complete) {
    return unsigned([
      'macOS code signing skipped: CSC_LINK and CSC_KEY_PASSWORD are not set, so the app is unsigned.',
      'macOS notarization skipped: only a signed app can be notarized.',
    ]);
  }
  if (notary.length > 0 && notary.length < APPLE_NOTARY.length) {
    return {
      sign: true,
      notarize: false,
      messages: [],
      env: {},
      error: `macOS notarization needs all of ${APPLE_NOTARY.join(', ')}; only ${notary.join(', ')} ${notary.length === 1 ? 'is' : 'are'} set.`,
    };
  }
  const notarize = notary.length === APPLE_NOTARY.length;
  return {
    sign: true,
    notarize,
    messages: [
      'macOS code signing: on (Developer ID certificate from CSC_LINK).',
      notarize
        ? 'macOS notarization: on.'
        : `macOS notarization skipped: ${APPLE_NOTARY.join(', ')} are not set, so Gatekeeper will warn on other Macs.`,
    ],
    env: {},
  };
}

function planWindows(env: Env): SigningPlan {
  const cert = certificate(env, 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD');
  if (cert.partial) {
    return {
      ...unsigned([]),
      error:
        'Windows signing needs both WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD.',
    };
  }
  if (!cert.complete) {
    return unsigned([
      'Windows code signing skipped: WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD are not set, so the installer is unsigned.',
    ]);
  }
  return {
    sign: true,
    notarize: false,
    messages: ['Windows code signing: on (certificate from WIN_CSC_LINK).'],
    env: {},
  };
}

export function planSigning(
  env: Env,
  platform: typeof process.platform,
): SigningPlan {
  if (platform === 'darwin') return planMac(env);
  if (platform === 'win32') return planWindows(env);
  return {
    sign: false,
    notarize: false,
    messages: ['Linux builds are not signed.'],
    env: {},
  };
}

function main(): void {
  const plan = planSigning(process.env, process.platform);
  plan.messages.forEach((message) => console.log(`::notice::${message}`));
  if (plan.error) {
    console.log(`::error::${plan.error}`);
    process.exitCode = 1;
    return;
  }
  const githubEnv = process.env.GITHUB_ENV;
  const lines = Object.entries(plan.env).map(
    ([key, value]) => `${key}=${value}\n`,
  );
  if (githubEnv && lines.length > 0)
    fs.appendFileSync(githubEnv, lines.join(''));
}

if (require.main === module) main();
