describe('displayFontFamily', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('falls back to android system font for math symbols', () => {
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
        select: ({ android }: { android?: string }) => android,
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { displayFontFamily } = require('./fonts');
    expect(displayFontFamily('×')).toBe('sans-serif-medium');
    expect(displayFontFamily('÷')).toBe('sans-serif-medium');
  });

  it('keeps Fredoka for regular latin text', () => {
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
        select: ({ android }: { android?: string }) => android,
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { displayFontFamily } = require('./fonts');
    expect(displayFontFamily('123')).toBe('Fredoka_700Bold');
  });
});
