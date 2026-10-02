/**
 * @jest-environment node
 */
import { planSigning } from '../../.erb/scripts/release-signing';

const CERT = { CSC_LINK: 'base64-p12', CSC_KEY_PASSWORD: 'secret' };
const NOTARY = {
  APPLE_ID: 'dev@example.com',
  APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh-ijkl-mnop',
  APPLE_TEAM_ID: 'TEAM123456',
};

describe('planSigning on macOS', () => {
  it('skips signing and notarization without secrets, and says why', () => {
    const plan = planSigning({}, 'darwin');
    expect(plan).toEqual(
      expect.objectContaining({
        sign: false,
        notarize: false,
        env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
      }),
    );
    expect(plan.error).toBeUndefined();
    expect(plan.messages).toEqual([
      expect.stringContaining(
        'code signing skipped: CSC_LINK and CSC_KEY_PASSWORD are not set',
      ),
      expect.stringContaining('notarization skipped'),
    ]);
  });

  it('treats empty secrets as missing', () => {
    expect(
      planSigning(
        { CSC_LINK: '', CSC_KEY_PASSWORD: ' ', APPLE_ID: '' },
        'darwin',
      ).sign,
    ).toBe(false);
  });

  it('signs and notarizes with every secret', () => {
    const plan = planSigning({ ...CERT, ...NOTARY }, 'darwin');
    expect(plan).toEqual(
      expect.objectContaining({ sign: true, notarize: true, env: {} }),
    );
    expect(plan.messages.join('\n')).not.toContain(NOTARY.APPLE_ID);
  });

  it('signs without notarizing when no Apple account is set', () => {
    const plan = planSigning(CERT, 'darwin');
    expect(plan.sign).toBe(true);
    expect(plan.notarize).toBe(false);
    expect(plan.messages[1]).toContain('notarization skipped');
  });

  it('fails on a partly configured Apple account', () => {
    const plan = planSigning(
      {
        ...CERT,
        APPLE_ID: NOTARY.APPLE_ID,
        APPLE_TEAM_ID: NOTARY.APPLE_TEAM_ID,
      },
      'darwin',
    );
    expect(plan.error).toBe(
      'macOS notarization needs all of APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID; only APPLE_ID, APPLE_TEAM_ID are set.',
    );
  });

  it('fails on a certificate without its password', () => {
    expect(planSigning({ CSC_LINK: 'x' }, 'darwin').error).toContain(
      'CSC_LINK and CSC_KEY_PASSWORD',
    );
  });
});

describe('planSigning on other platforms', () => {
  it('keeps Windows unsigned without its own certificate', () => {
    const plan = planSigning({ ...CERT, ...NOTARY }, 'win32');
    expect(plan.sign).toBe(false);
    expect(plan.env).toEqual({ CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
    expect(plan.messages[0]).toContain('Windows code signing skipped');
  });

  it('signs Windows with WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD', () => {
    expect(
      planSigning({ WIN_CSC_LINK: 'x', WIN_CSC_KEY_PASSWORD: 'y' }, 'win32')
        .sign,
    ).toBe(true);
  });

  it('never signs Linux', () => {
    expect(planSigning({ ...CERT, ...NOTARY }, 'linux')).toEqual({
      sign: false,
      notarize: false,
      messages: ['Linux builds are not signed.'],
      env: {},
    });
  });
});
