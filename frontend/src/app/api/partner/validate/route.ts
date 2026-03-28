import { proxyPartnerRequest } from '../_shared';

export async function POST(request: Request) {
  return await proxyPartnerRequest(request, '/auth/api-keys/validate');
}
