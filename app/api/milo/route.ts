import { createRequestSupabaseClient, type ServerSupabaseContext } from "@/lib/supabase/server";
import { ensureDemoSession } from "@/lib/supabase/demo";
import { executeSafeAction, validateActionRequest } from "@/lib/milo/actions";
import { errorResponse, MiloError, successResponse } from "@/lib/milo/errors";
import { interpretTextRequest, type GeminiImageInput } from "@/lib/milo/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_FIELDS = new Set(["action", "args", "message", "text", "image"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new MiloError("INVALID_REQUEST", 400, "The request body must be valid JSON.");
  }

  if (!isRecord(body)) {
    throw new MiloError("INVALID_REQUEST", 400, "The request body must be a JSON object.");
  }

  const unknownFields = Object.keys(body).filter((key) => !BODY_FIELDS.has(key));
  if (unknownFields.length > 0) {
    throw new MiloError("INVALID_REQUEST", 400, "The request contains an unsupported field.", {
      fields: unknownFields,
    });
  }

  return body;
}

function getTextRequest(body: Record<string, unknown>): string | undefined {
  const message = body.message ?? body.text;
  if (message === undefined) return undefined;
  if (typeof message !== "string") {
    throw new MiloError("INVALID_REQUEST", 400, "Text requests must be strings.", {
      field: body.message !== undefined ? "message" : "text",
    });
  }

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 2_000) {
    throw new MiloError(
      "INVALID_REQUEST",
      400,
      trimmed ? "Text requests are limited to 2,000 characters." : "Text requests cannot be empty.",
      { field: body.message !== undefined ? "message" : "text" },
    );
  }
  return trimmed;
}

function getImageRequest(body: Record<string, unknown>): GeminiImageInput | undefined {
  if (body.image === undefined) return undefined;
  if (!isRecord(body.image)) {
    throw new MiloError("INVALID_REQUEST", 400, "Image input must include mimeType and base64 data.");
  }

  const mimeType = body.image.mimeType;
  const data = body.image.data;
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (typeof mimeType !== "string" || !allowedTypes.has(mimeType)) {
    throw new MiloError("INVALID_REQUEST", 400, "Use a JPEG, PNG, or WebP image.");
  }

  if (typeof data !== "string" || data.length === 0 || data.length > 7_000_000) {
    throw new MiloError("INVALID_REQUEST", 400, "Image data is missing or too large.");
  }

  return { mimeType: mimeType as GeminiImageInput["mimeType"], data };
}

async function resolveAction(body: Record<string, unknown>) {
  const text = getTextRequest(body);
  const image = getImageRequest(body);
  const hasAction = body.action !== undefined;
  if (hasAction && (text !== undefined || image !== undefined)) {
    throw new MiloError(
      "INVALID_REQUEST",
      400,
      "Send either text/image input or an explicit action, not both.",
    );
  }

  if (hasAction) {
    const validated = validateActionRequest(body.action, body.args);
    return { kind: "action" as const, ...validated };
  }

  if (text !== undefined || image !== undefined) {
    const interpretation = await interpretTextRequest(
      text ?? "Inspect this healthcare evidence image and create the safest single operational update.",
      image,
    );
    if (interpretation.kind === "answer") return interpretation;
    return { kind: "action" as const, ...validateActionRequest(interpretation.action, interpretation.arguments) };
  }

  throw new MiloError(
    "INVALID_REQUEST",
    400,
    "Provide a text request or one allowlisted action.",
  );
}

function responseHeaders(context?: ServerSupabaseContext): Headers | undefined {
  return context ? context.responseHeaders : undefined;
}

export async function GET() {
  let context: ServerSupabaseContext | undefined;
  try {
    context = await createRequestSupabaseClient();
    const session = await ensureDemoSession(context.client);
    return successResponse(
      {
        session: { anonymous: session.user.is_anonymous ?? true },
        facility: session.facility,
      },
      responseHeaders(context),
    );
  } catch (error) {
    return errorResponse(error, responseHeaders(context));
  }
}

export async function POST(request: Request) {
  let context: ServerSupabaseContext | undefined;
  try {
    const body = await parseBody(request);
    const requestedAction = await resolveAction(body);
    context = await createRequestSupabaseClient();
    const session = await ensureDemoSession(context.client);
    if (requestedAction.kind === "answer") {
      return successResponse(
        {
          text: requestedAction.text,
          facility: session.facility,
          session: { anonymous: session.user.is_anonymous ?? true },
        },
        responseHeaders(context),
      );
    }

    const result = await executeSafeAction(
      context.client,
      requestedAction.action,
      requestedAction.arguments,
      session.facilityId,
    );

    return successResponse(
      {
        action: {
          name: requestedAction.action,
          arguments: requestedAction.arguments,
        },
        data: result,
        facility: session.facility,
        session: { anonymous: session.user.is_anonymous ?? true },
      },
      responseHeaders(context),
    );
  } catch (error) {
    return errorResponse(error, responseHeaders(context));
  }
}
