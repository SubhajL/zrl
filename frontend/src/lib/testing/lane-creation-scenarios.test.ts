import {
  LIVE_LANE_CREATION_SCENARIOS,
  UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS,
} from './lane-creation-scenarios';

describe('lane creation scenario support filters', () => {
  it('treats japan longan as unsupported live coverage', () => {
    expect(
      LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'longan-japan-air',
      ),
    ).toBe(false);
    expect(
      UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'longan-japan-air',
      ),
    ).toBe(true);
  });

  it('treats korea durian as supported live coverage', () => {
    expect(
      LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'durian-korea-air',
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'durian-korea-air',
      ),
    ).toBe(false);
  });
});
