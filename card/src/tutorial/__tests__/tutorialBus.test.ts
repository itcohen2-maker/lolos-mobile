import { tutorialBus } from '../tutorialBus';

describe('tutorialBus lesson-specific modes', () => {
  afterEach(() => {
    tutorialBus._reset();
  });

  it('tracks lesson-5 guided mode on/off', () => {
    expect(tutorialBus.getL5GuidedMode()).toBe(false);
    tutorialBus.setL5GuidedMode(true);
    expect(tutorialBus.getL5GuidedMode()).toBe(true);
    tutorialBus.setL5GuidedMode(false);
    expect(tutorialBus.getL5GuidedMode()).toBe(false);
  });

  it('resets lesson-5 guided mode in _reset', () => {
    tutorialBus.setL5GuidedMode(true);
    tutorialBus._reset();
    expect(tutorialBus.getL5GuidedMode()).toBe(false);
  });

  it('tracks fractions guided mode and resets in _reset', () => {
    expect(tutorialBus.getFracGuidedMode()).toBe(false);
    tutorialBus.setFracGuidedMode(true);
    expect(tutorialBus.getFracGuidedMode()).toBe(true);
    tutorialBus._reset();
    expect(tutorialBus.getFracGuidedMode()).toBe(false);
  });

  it('tracks lesson-5 hide-fan flag', () => {
    expect(tutorialBus.getL5HideFan()).toBe(false);
    tutorialBus.setL5HideFan(true);
    expect(tutorialBus.getL5HideFan()).toBe(true);
    tutorialBus._reset();
    expect(tutorialBus.getL5HideFan()).toBe(false);
  });

  it('notifies L5 UI subscribers when guided or hide-fan toggles', () => {
    let n = 0;
    const unsub = tutorialBus.subscribeL5Ui(() => {
      n += 1;
    });
    tutorialBus.setL5GuidedMode(true);
    tutorialBus.setL5HideFan(true);
    expect(n).toBe(2);
    unsub();
    tutorialBus.setL5GuidedMode(false);
    expect(n).toBe(2);
  });
});
