import { ConflictException } from '@nestjs/common';
import {
  assertTransitionGraph,
  assertTransitionGuards,
  getAutomaticTransitionTarget,
} from './lane.transition-policy';

describe('LaneTransitionPolicy', () => {
  describe('assertTransitionGraph', () => {
    it('allows valid transitions', () => {
      expect(() =>
        assertTransitionGraph('EVIDENCE_COLLECTING', 'VALIDATED'),
      ).not.toThrow();
    });

    it('rejects invalid transitions with ConflictException', () => {
      expect(() =>
        assertTransitionGraph('EVIDENCE_COLLECTING', 'PACKED'),
      ).toThrow(ConflictException);
    });

    it('rejects transitions from terminal states', () => {
      expect(() => assertTransitionGraph('ARCHIVED', 'CREATED')).toThrow(
        ConflictException,
      );
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

    it('returns null for states without automatic transitions', () => {
      expect(
        getAutomaticTransitionTarget({
          status: 'VALIDATED',
          completenessScore: 100,
        }),
      ).toBeNull();
    });
  });

  describe('assertTransitionGuards', () => {
    it('throws when validating below completeness threshold', () => {
      expect(() =>
        assertTransitionGuards(
          { completenessScore: 50, statusChangedAt: new Date() },
          'VALIDATED',
          { proofPackCount: 0 },
        ),
      ).toThrow('Lane completeness must be at least 95% before validation.');
    });

    it('throws when packing without proof packs', () => {
      expect(() =>
        assertTransitionGuards(
          { completenessScore: 100, statusChangedAt: new Date() },
          'PACKED',
          { proofPackCount: 0 },
        ),
      ).toThrow('At least one proof pack is required before packing.');
    });

    it('allows packing with proof packs', () => {
      expect(() =>
        assertTransitionGuards(
          { completenessScore: 100, statusChangedAt: new Date() },
          'PACKED',
          { proofPackCount: 2 },
        ),
      ).not.toThrow();
    });

    it('throws when archiving before retention period', () => {
      const recentDate = new Date();
      expect(() =>
        assertTransitionGuards(
          { completenessScore: 100, statusChangedAt: recentDate },
          'ARCHIVED',
          { proofPackCount: 0 },
        ),
      ).toThrow('Lane cannot be archived before the retention period ends.');
    });

    it('allows archiving after retention period', () => {
      const oldDate = new Date('2010-01-01T00:00:00.000Z');
      expect(() =>
        assertTransitionGuards(
          { completenessScore: 100, statusChangedAt: oldDate },
          'ARCHIVED',
          { proofPackCount: 0 },
        ),
      ).not.toThrow();
    });
  });
});
