import { NextResponse } from 'next/server';
import { parseBackendBody, requestBackend } from '@/lib/backend-api';

interface PartnerProxyInput {
  readonly apiKey: string;
  readonly payload?: unknown;
}

async function readPartnerProxyInput(
  request: Request,
): Promise<PartnerProxyInput> {
  try {
    return (await request.json()) as PartnerProxyInput;
  } catch {
    throw new Error('Partner request body must be valid JSON.');
  }
}

function buildError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function proxyPartnerRequest(
  request: Request,
  path: string,
): Promise<NextResponse> {
  let input: PartnerProxyInput;
  try {
    input = await readPartnerProxyInput(request);
  } catch (error) {
    return buildError(
      error instanceof Error ? error.message : 'Invalid partner request body.',
    );
  }

  if (typeof input.apiKey !== 'string' || input.apiKey.trim().length === 0) {
    return buildError('Partner API key is required.');
  }

  const backendResponse = await requestBackend(path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': input.apiKey.trim(),
    },
    body:
      input.payload === undefined
        ? undefined
        : JSON.stringify(input.payload),
  });

  const body = await parseBackendBody(backendResponse);

  if (typeof body === 'string') {
    return new NextResponse(body, {
      status: backendResponse.status,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  return NextResponse.json(body, { status: backendResponse.status });
}
