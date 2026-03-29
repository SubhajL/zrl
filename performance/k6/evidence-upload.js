import { createLane, listLaneArtifacts, login, uploadArtifact } from './shared.js';

export const options = {
  scenarios: {
    evidence_upload: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.K6_UPLOAD_VUS || 3),
      iterations: Number(__ENV.K6_UPLOAD_ITERATIONS || 1),
      maxDuration: __ENV.K6_UPLOAD_MAX_DURATION || '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const token = login();
  const lane = createLane(token);

  uploadArtifact(token, lane.publicId, {
    artifactType: 'INVOICE',
    fileName: 'commercial-invoice.pdf',
    mimeType: 'application/pdf',
    contents: 'commercial-invoice',
    metadata: {
      documentType: 'Commercial Invoice',
    },
  });

  listLaneArtifacts(token, lane.publicId);
}
