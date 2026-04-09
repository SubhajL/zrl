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

  it('treats korea longan as unsupported live coverage', () => {
    expect(
      LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'longan-korea-truck',
      ),
    ).toBe(false);
    expect(
      UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'longan-korea-truck',
      ),
    ).toBe(true);
  });

  it('treats eu mango as supported live coverage', () => {
    expect(
      LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'mango-eu-air',
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'mango-eu-air',
      ),
    ).toBe(false);
  });

  it('treats eu durian as supported live coverage', () => {
    expect(
      LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'durian-eu-sea',
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'durian-eu-sea',
      ),
    ).toBe(false);
  });

  it('treats eu mangosteen as supported live coverage', () => {
    expect(
      LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'mangosteen-eu-truck',
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS.some(
        (scenario) => scenario.name === 'mangosteen-eu-truck',
      ),
    ).toBe(false);
  });
});
