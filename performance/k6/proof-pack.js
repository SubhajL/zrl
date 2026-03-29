import { Trend } from 'k6/metrics';
import {
  createLane,
  login,
  seedRequiredEvidence,
  triggerPackGeneration,
  verifyPack,
  waitForCompleteness,
  waitForReadyPack,
} from './shared.js';

const packReadyDuration = new Trend('pack_ready_duration', true);

export const options = {
  scenarios: {
    proof_pack: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.K6_PACK_VUS || 1),
      iterations: Number(__ENV.K6_PACK_ITERATIONS || 1),
      maxDuration: __ENV.K6_PACK_MAX_DURATION || '3m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
    pack_ready_duration: ['p(95)<15000'],
  },
};

export default function () {
  const token = login();
  const lane = createLane(token);

  seedRequiredEvidence(token, lane.publicId);
  waitForCompleteness(token, lane.publicId, 95);

  const startedAt = Date.now();
  const queuedPack = triggerPackGeneration(token, lane.publicId, 'REGULATOR');
  waitForReadyPack(token, lane.publicId, queuedPack.id);
  packReadyDuration.add(Date.now() - startedAt);

  verifyPack(queuedPack.id);
}
