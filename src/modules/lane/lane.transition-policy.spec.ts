import {
  validateTransitionGraph,
  validateTransitionGuards,
  getAutomaticTransitionTarget,
} from './lane.transition-policy';

describe('LaneTransitionPolicy', () => {
  describe('validateTransitionGraph', () => {
    it('returns null for valid transitions', () => {
      expect(
        validateTransitionGraph('EVIDENCE_COLLECTING', 'VALIDATED'),
      ).toBeNull();
    });

    it('returns INVALID_TRANSITION violation for invalid transitions', () => {
      const violation = validateTransitionGraph(
        'EVIDENCE_COLLECTING',
        'PACKED',
      );
      expect(violation).not.toBeNull();
      expect(violation!.code).toBe('INVALID_TRANSITION');
      expect(violation!.message).toContain('EVIDENCE_COLLECTING');
    });

    it('returns violation for transitions from terminal states', () => {
      const violation = validateTransitionGraph('ARCHIVED', 'CREATED');
      expect(violation).not.toBeNull();
      expect(violation!.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('getAutomaticTransitionTarget', () => {
    it('returns EVIDENCE_COLLECTING when completeness meets threshold from CREATED', () => {
      expect(
        getAutomaticTransitionTarget({
          status: 'CREATED',
          completenessScore: 95,
        }),
      ).toBe('EVIDENCE_COLLECTING');
    });

    it('returns VALIDATED when completeness meets threshold from EVIDENCE_COLLECTING', () => {
      expect(
        getAutomaticTransitionTarget({
          status: 'EVIDENCE_COLLECTING',
          completenessScore: 95,
        }),
      ).toBe('VALIDATED');
    });

    it('returns null when completeness is below threshold', () => {
      expect(
        getAutomaticTransitionTarget({
          status: 'EVIDENCE_COLLECTING',
          completenessScore: 50,
        }),
      ).toBeNull();
    });

    it('returns PACKED when a validated lane has a ready proof pack', () => {
      expect(
        getAutomaticTransitionTarget(
          {
            status: 'VALIDATED',
            completenessScore: 100,
          },
          { proofPackCount: 1 },
        ),
      ).toBe('PACKED');
    });

    it('returns null for states without automatic transitions', () => {
      expect(
        getAutomaticTransitionTarget({
          status: 'VALIDATED',
          completenessScore: 100,
        }),
      ).toBeNull();
    });
  });

  describe('validateTransitionGuards', () => {
    it('returns GUARD_FAILED when validating below completeness threshold', () => {
      const violation = validateTransitionGuards(
        { completenessScore: 50, statusChangedAt: new Date() },
        'VALIDATED',
        { proofPackCount: 0 },
      );
      expect(violation).not.toBeNull();
      expect(violation!.code).toBe('GUARD_FAILED');
      expect(violation!.message).toContain('95%');
    });

    it('returns GUARD_FAILED when packing without proof packs', () => {
      const violation = validateTransitionGuards(
        { completenessScore: 100, statusChangedAt: new Date() },
        'PACKED',
        { proofPackCount: 0 },
      );
      expect(violation).not.toBeNull();
      expect(violation!.code).toBe('GUARD_FAILED');
      expect(violation!.message).toContain('proof pack');
    });

    it('returns null when packing with proof packs', () => {
      expect(
        validateTransitionGuards(
          { completenessScore: 100, statusChangedAt: new Date() },
          'PACKED',
          { proofPackCount: 2 },
        ),
      ).toBeNull();
    });

    it('returns GUARD_FAILED when archiving before retention period', () => {
      const violation = validateTransitionGuards(
        { completenessScore: 100, statusChangedAt: new Date() },
        'ARCHIVED',
        { proofPackCount: 0 },
      );
      expect(violation).not.toBeNull();
      expect(violation!.code).toBe('GUARD_FAILED');
      expect(violation!.message).toContain('retention');
    });

    it('returns null when archiving after retention period', () => {
      expect(
        validateTransitionGuards(
          { completenessScore: 100, statusChangedAt: new Date('2010-01-01') },
          'ARCHIVED',
          { proofPackCount: 0 },
        ),
      ).toBeNull();
    });
  });
});
