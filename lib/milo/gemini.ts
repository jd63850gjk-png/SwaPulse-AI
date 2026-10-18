import "server-only";

import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Schema,
} from "@google/generative-ai";
import { actionDefinitionsForGemini, ALLOWED_ACTIONS, type ActionArguments, type ActionName } from "@/lib/milo/actions";
import { MiloError } from "@/lib/milo/errors";
import { getServerEnv } from "@/lib/server/env";

const GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiImageInput = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

function stringSchema(description: string): Schema {
  return { type: SchemaType.STRING, description };
}

function numberSchema(description: string): Schema {
  return { type: SchemaType.NUMBER, description };
}

function integerSchema(description: string): Schema {
  return { type: SchemaType.INTEGER, description };
}

function booleanSchema(description: string): Schema {
  return { type: SchemaType.BOOLEAN, description };
}

function declaration(
  name: ActionName,
  description: string,
  properties: Record<string, Schema>,
  required: string[] = [],
): FunctionDeclaration {
  return {
    name,
    description,
    ...(Object.keys(properties).length > 0
      ? {
          parameters: {
            type: SchemaType.OBJECT,
            properties,
            ...(required.length > 0 ? { required } : {}),
          },
        }
      : {}),
  };
}

const SAFE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  declaration("get_dashboard_summary", "Read the current demo facility dashboard summary." , {}),
  declaration("list_low_stock_items", "List inventory items below the requested stock threshold.", {
    threshold: numberSchema("Optional non-negative stock threshold."),
  }),
  declaration("add_inventory_item", "Add one inventory item to the current demo facility.", {
    item_name: stringSchema("Inventory item name."),
    unit: stringSchema("Inventory unit, such as packets or boxes."),
    quantity: numberSchema("Initial non-negative quantity."),
    reorder_level: numberSchema("Optional non-negative reorder level."),
  }, ["item_name", "unit", "quantity"]),
  declaration("update_inventory_stock", "Set an existing inventory item's non-negative stock quantity.", {
    item_id: stringSchema("Existing inventory item identifier."),
    quantity: numberSchema("New non-negative stock quantity."),
    reason: stringSchema("Optional reason for the stock update."),
  }, ["item_id", "quantity"]),
  declaration("record_patient_footfall", "Record today's patient footfall count.", {
    count: integerSchema("Non-negative patient count."),
    recorded_on: stringSchema("Optional ISO date for the record."),
  }, ["count"]),
  declaration("update_bed_status", "Update the status of one existing bed.", {
    bed_id: stringSchema("Existing bed identifier."),
    status: stringSchema("Bed status, such as available, occupied, or maintenance."),
  }, ["bed_id", "status"]),
  declaration("record_staff_attendance", "Record attendance for one existing staff member.", {
    staff_id: stringSchema("Existing staff member identifier."),
    status: stringSchema("Attendance status."),
    attendance_date: stringSchema("Optional ISO date for the attendance record."),
  }, ["staff_id", "status"]),
  declaration("update_test_availability", "Update whether one existing test is available.", {
    test_id: stringSchema("Existing test identifier."),
    available: booleanSchema("Whether the test is currently available."),
    reason: stringSchema("Optional reason for the availability update."),
  }, ["test_id", "available"]),
  declaration("create_alert", "Create a focused operational alert for the current facility.", {
    title: stringSchema("Short alert title."),
    message: stringSchema("Alert details."),
    severity: stringSchema("Alert severity, such as info, warning, or critical."),
  }, ["title", "message", "severity"]),
  declaration("create_task", "Create a follow-up task for the current facility.", {
    title: stringSchema("Short task title."),
    description: stringSchema("Optional task details."),
    due_date: stringSchema("Optional ISO due date."),
  }, ["title"]),
];

const SAFE_TOOL_NAMES = new Set<string>(ALLOWED_ACTIONS);

type TextInterpretation =
  | { kind: "action"; action: ActionName; arguments: ActionArguments }
  | { kind: "answer"; text: string };

function offlineInterpretation(message: string): TextInterpretation {
  const normalized = message.toLowerCase();

  if (/(low stock|running low|shortage|stock.?out|supplies)/.test(normalized)) {
    return { kind: "action", action: "list_low_stock_items", arguments: {} };
  }
  if (/(dashboard|summary|overview|facility status|how are we|what.?s happening|status)/.test(normalized)) {
    return { kind: "action", action: "get_dashboard_summary", arguments: {} };
  }
  if (/(bed|capacity|ward|staff|attendance|doctor|nurse|team|test|diagnostic|malaria|cbc)/.test(normalized)) {
    return { kind: "action", action: "get_dashboard_summary", arguments: {} };
  }
  return {
    kind: "answer",
    text: "I’m Milo, SwaPulse AI’s facility operations assistant. I can read the live dashboard, find low-stock supplies, update inventory, record footfall, update beds, track staff attendance and test availability, and create alerts or tasks. Ask me about this facility or give me an explicit update.",
  };
}

export async function interpretTextRequest(
  message: string,
  image?: GeminiImageInput,
): Promise<{
  kind: "action";
  action: ActionName;
  arguments: ActionArguments;
} | {
  kind: "answer";
  text: string;
}> {
  const { geminiApiKey } = getServerEnv();

  if (!geminiApiKey) return offlineInterpretation(message);

  const model = new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      "You are Milo, the SwaPulse health operations assistant. For facility operations, map the user's request to exactly one provided safe function. For general knowledge questions or explanations, answer naturally without calling a function. Never invent identifiers, never request or perform deletes, raw SQL, schema changes, arbitrary tables, or actions outside the provided functions. If an operational request lacks required details, ask a concise clarification question instead of inventing values.",
    tools: [{ functionDeclarations: SAFE_TOOL_DECLARATIONS }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
        allowedFunctionNames: [...ALLOWED_ACTIONS],
      },
    },
  });

  let result;
  try {
    result = await model.generateContent(
      image
        ? [
            { text: message },
            { inlineData: { mimeType: image.mimeType, data: image.data } },
          ]
        : message,
    );
  } catch {
    return offlineInterpretation(message);
  }

  let calls;
  try {
    calls = result.response.functionCalls();
  } catch {
    throw new MiloError("GEMINI_NO_ACTION", 422, "The request could not be mapped to a safe action.");
  }

  if (!calls || calls.length === 0) {
    let text = "";
    try {
      text = result.response.text().trim();
    } catch {
      text = "";
    }

    if (text) {
      return { kind: "answer", text };
    }

    throw new MiloError("GEMINI_NO_ACTION", 422, "The request could not be mapped to one safe action.");
  }

  if (calls.length !== 1) {
    throw new MiloError("GEMINI_NO_ACTION", 422, "The request could not be mapped to one safe action.");
  }

  const [call] = calls;
  if (!SAFE_TOOL_NAMES.has(call.name) || !ALLOWED_ACTIONS.includes(call.name as ActionName)) {
    throw new MiloError("INVALID_ACTION", 400, "The requested action is not allowed.");
  }

  const definitions = actionDefinitionsForGemini();
  if (!definitions[call.name as ActionName]) {
    throw new MiloError("INVALID_ACTION", 400, "The requested action is not allowed.");
  }

  return {
    kind: "action",
    action: call.name as ActionName,
    arguments: (call.args ?? {}) as ActionArguments,
  };
}

/**
 * Image input intentionally stops at this boundary for the MVP. A future
 * adapter can convert a validated image part into Gemini's inlineData format
 * before invoking the same safe action validation and execution path.
 */
export const IMAGE_INPUT_EXTENSION_POINT = "lib/milo/gemini.ts";
