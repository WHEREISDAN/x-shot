/**
 * Fails a test that logs through console.error or console.warn, e.g. a
 * React act() or style warning, so such noise cannot creep back unseen.
 */
const logged: string[] = [];
let spies: jest.SpyInstance[] = [];

beforeEach(() => {
  logged.length = 0;
  spies = (['error', 'warn'] as const).map((level) =>
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(`console.${level}: ${args.map(String).join(' ')}`);
    }),
  );
});

afterEach(() => {
  spies.forEach((spy) => spy.mockRestore());
  const messages = logged.splice(0);
  if (messages.length > 0) {
    throw new Error(
      `The test logged ${messages.length} warning(s):\n${messages
        .map((message) => message.slice(0, 500))
        .join('\n')}`,
    );
  }
});
