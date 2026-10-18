export type MiloErrorCode =
  | "CONFIGURATION_ERROR"
  | "INVALID_REQUEST"
  | "INVALID_ACTION"
  | "INVALID_ACTION_ARGUMENTS"
  | "IMAGE_INPUT_NOT_SUPPORTED"
  | "AUTHENTICATION_FAILED"
  | "DEMO_FACILITY_JOIN_FAILED"
  | "SCHEMA_UNSUPPORTED"
  | "ACTION_FAILED"
  | "GEMINI_REQUEST_FAILED"
  | "GEMINI_NO_ACTION"
  | "INTERNAL_ERROR";

export class MiloError extends Error {
  readonly code: MiloErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: MiloErrorCode,
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MiloError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error: unknown, responseHeaders?: Headers): Response {
  const knownError = error instanceof MiloError;
  const payload = knownError
    ? {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      }
    : {
        ok: false,
        error: {
          code: "INTERNAL_ERROR" as const,
          message: "Milo could not complete the request.",
        },
      };

  const headers = new Headers(responseHeaders);
  headers.set("Cache-Control", "private, no-store");

  return Response.json(payload, {
    status: knownError ? error.status : 500,
    headers,
  });
}

export function successResponse(
  payload: Record<string, unknown>,
  responseHeaders?: Headers,
): Response {
  const headers = new Headers(responseHeaders);
  headers.set("Cache-Control", "private, no-store");
  return Response.json({ ok: true, ...payload }, { headers });
}
