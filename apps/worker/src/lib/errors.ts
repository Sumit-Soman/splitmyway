export type ApiErrorBody = {
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
};

export function jsonError(
  status: number,
  message: string,
  code?: string,
  details?: unknown
): Response {
  const body: ApiErrorBody = { ok: false, error: message, code, details };
  return Response.json(body, { status });
}

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ ok: true as const, data }, { status });
}
