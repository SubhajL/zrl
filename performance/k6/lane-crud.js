import {
  createLane,
  getLaneCompleteness,
  getLaneDetail,
  listLanes,
  login,
} from './shared.js';

export const options = {
  scenarios: {
    lane_crud: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.K6_LANE_VUS || 5),
      iterations: Number(__ENV.K6_LANE_ITERATIONS || 2),
      maxDuration: __ENV.K6_LANE_MAX_DURATION || '2m',
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
  listLanes(token);
  const lane = createLane(token);
  getLaneDetail(token, lane.publicId);
  getLaneCompleteness(token, lane.publicId);
}
