import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MiloError } from "@/lib/milo/errors";

export const ALLOWED_ACTIONS = [
  "get_dashboard_summary",
  "list_low_stock_items",
  "add_inventory_item",
  "update_inventory_stock",
  "record_patient_footfall",
  "update_bed_status",
  "record_staff_attendance",
  "update_test_availability",
  "create_alert",
  "create_task",
] as const;

export type ActionName = (typeof ALLOWED_ACTIONS)[number];
export type ActionArguments = Record<string, unknown>;

type FieldType = "string" | "integer" | "number" | "boolean";
type FieldDefinition = {
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  nonEmpty?: boolean;
};

export type ActionDefinition = {
  fields: Record<string, FieldDefinition>;
};

const ACTION_DEFINITIONS: Record<ActionName, ActionDefinition> = {
  get_dashboard_summary: { fields: {} },
  list_low_stock_items: {
    fields: { threshold: { type: "number", min: 0 } },
  },
  add_inventory_item: {
    fields: {
      item_name: { type: "string", required: true, maxLength: 120, nonEmpty: true },
      unit: { type: "string", required: true, maxLength: 40, nonEmpty: true },
      quantity: { type: "number", required: true, min: 0 },
      reorder_level: { type: "number", min: 0 },
    },
  },
  update_inventory_stock: {
    fields: {
      item_id: { type: "string", required: true, maxLength: 120, nonEmpty: true },
      quantity: { type: "number", required: true, min: 0 },
      reason: { type: "string", maxLength: 300 },
    },
  },
  record_patient_footfall: {
    fields: {
      count: { type: "integer", required: true, min: 0 },
      recorded_on: { type: "string", maxLength: 40 },
    },
  },
  update_bed_status: {
    fields: {
      bed_id: { type: "string", required: true, maxLength: 120, nonEmpty: true },
      status: { type: "string", required: true, maxLength: 40, nonEmpty: true },
    },
  },
  record_staff_attendance: {
    fields: {
      staff_id: { type: "string", required: true, maxLength: 120, nonEmpty: true },
      status: { type: "string", required: true, maxLength: 40, nonEmpty: true },
      attendance_date: { type: "string", maxLength: 40 },
    },
  },
  update_test_availability: {
    fields: {
      test_id: { type: "string", required: true, maxLength: 120, nonEmpty: true },
      available: { type: "boolean", required: true },
      reason: { type: "string", maxLength: 300 },
    },
  },
  create_alert: {
    fields: {
      title: { type: "string", required: true, maxLength: 160, nonEmpty: true },
      message: { type: "string", required: true, maxLength: 1000, nonEmpty: true },
      severity: { type: "string", required: true, maxLength: 40, nonEmpty: true },
    },
  },
  create_task: {
    fields: {
      title: { type: "string", required: true, maxLength: 160, nonEmpty: true },
      description: { type: "string", maxLength: 1000 },
      due_date: { type: "string", maxLength: 40 },
    },
  },
};

const BED_STATUSES = new Set(["available", "occupied", "maintenance"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActionName(value: unknown): value is ActionName {
  return typeof value === "string" && (ALLOWED_ACTIONS as readonly string[]).includes(value);
}

function validFieldType(value: unknown, type: FieldType): boolean {
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === "number" && Number.isFinite(value);
}

export function validateActionRequest(
  action: unknown,
  rawArguments: unknown,
): { action: ActionName; arguments: ActionArguments } {
  if (!isActionName(action)) {
    throw new MiloError("INVALID_ACTION", 400, "The requested action is not allowed.", {
      allowedActions: [...ALLOWED_ACTIONS],
    });
  }

  const definition = ACTION_DEFINITIONS[action];
  const argumentsObject = rawArguments === undefined ? {} : rawArguments;

  if (!isRecord(argumentsObject)) {
    throw new MiloError(
      "INVALID_ACTION_ARGUMENTS",
      400,
      "Action arguments must be a JSON object.",
      { action },
    );
  }

  const unknownKeys = Object.keys(argumentsObject).filter(
    (key) => !Object.prototype.hasOwnProperty.call(definition.fields, key),
  );
  if (unknownKeys.length > 0) {
    throw new MiloError(
      "INVALID_ACTION_ARGUMENTS",
      400,
      "The action received an unsupported argument.",
      { action, fields: unknownKeys },
    );
  }

  for (const [fieldName, field] of Object.entries(definition.fields)) {
    const value = argumentsObject[fieldName];
    if (value === undefined) {
      if (field.required) {
        throw new MiloError(
          "INVALID_ACTION_ARGUMENTS",
          400,
          "The action is missing a required argument.",
          { action, field: fieldName },
        );
      }
      continue;
    }

    if (!validFieldType(value, field.type)) {
      throw new MiloError(
        "INVALID_ACTION_ARGUMENTS",
        400,
        "An action argument has the wrong type.",
        { action, field: fieldName, expected: field.type },
      );
    }

    if (typeof value === "string" && field.maxLength && value.length > field.maxLength) {
      throw new MiloError(
        "INVALID_ACTION_ARGUMENTS",
        400,
        "An action argument is too long.",
        { action, field: fieldName, maxLength: field.maxLength },
      );
    }

    if (typeof value === "string" && field.nonEmpty && value.trim().length === 0) {
      throw new MiloError(
        "INVALID_ACTION_ARGUMENTS",
        400,
        "A required action argument cannot be empty.",
        { action, field: fieldName },
      );
    }

    if (typeof value === "number" && field.min !== undefined && value < field.min) {
      throw new MiloError(
        "INVALID_ACTION_ARGUMENTS",
        400,
        "An action argument is outside the allowed range.",
        { action, field: fieldName, min: field.min },
      );
    }
  }

  return { action, arguments: { ...argumentsObject } };
}

type Row = Record<string, unknown>;

function inputError(action: ActionName, message: string, details?: Record<string, unknown>): never {
  throw new MiloError("INVALID_ACTION_ARGUMENTS", 400, message, { action, ...details });
}

function actionError(action: ActionName, error?: unknown): never {
  const details = isRecord(error)
    ? { action, ...(typeof error.code === "string" ? { databaseCode: error.code } : {}) }
    : { action };
  throw new MiloError("ACTION_FAILED", 502, "The requested action could not be completed.", details);
}

function stringArgument(
  argumentsObject: ActionArguments,
  action: ActionName,
  field: string,
): string {
  const value = argumentsObject[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    return inputError(action, "The action argument must be a non-empty string.", { field });
  }
  return value.trim();
}

function dateArgument(
  value: unknown,
  action: ActionName,
  field: string,
  defaultValue?: string,
): string {
  const date = value === undefined ? defaultValue : value;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return inputError(action, "The date must use YYYY-MM-DD format.", { field });
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return inputError(action, "The date is invalid.", { field });
  }
  return date;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function asSafeNumber(row: Row, field: string, action: ActionName): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return actionError(action, { code: "INVALID_NUMERIC_ROW" });
  }
  return value;
}

async function readSingle(
  client: SupabaseClient,
  table: string,
  filters: Record<string, string>,
  action: ActionName,
  identifier: string,
): Promise<Row> {
  let query = client.from(table).select("*");
  for (const [field, value] of Object.entries(filters)) {
    query = query.eq(field, value);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (error.code === "22P02") {
      return inputError(action, "The requested identifier is invalid.", { identifier });
    }
    if (error.code === "PGRST116") {
      return inputError(action, "The requested record is ambiguous.", { identifier });
    }
    return actionError(action, error);
  }
  if (!data) {
    return inputError(action, "The requested record was not found in this facility.", { identifier });
  }
  return data as Row;
}

async function writeAudit(
  client: SupabaseClient,
  facilityId: string,
  action: ActionName,
  entityType: string,
  entityId: string | undefined,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await client.from("audit_log").insert({
      facility_id: facilityId,
      action,
      entity_type: entityType,
      ...(entityId ? { entity_id: entityId } : {}),
      details,
    });
  } catch {
    // Audit logging is best effort. It must not turn a successful table write into a failure.
  }
}

async function readScopedTable(
  client: SupabaseClient,
  table: string,
  facilityId: string,
  action: ActionName,
): Promise<Row[]> {
  const { data, error } = await client.from(table).select("*").eq("facility_id", facilityId);
  if (error) return actionError(action, error);
  return (data ?? []) as Row[];
}

async function insertRow(
  client: SupabaseClient,
  table: string,
  payload: Row,
  action: ActionName,
): Promise<Row> {
  const { data, error } = await client.from(table).insert(payload).select("*").single();
  if (error || !data) return actionError(action, error);
  return data as Row;
}

async function updateRow(
  client: SupabaseClient,
  table: string,
  filters: Record<string, string>,
  payload: Row,
  action: ActionName,
  identifier: string,
): Promise<Row> {
  let query = client.from(table).update(payload);
  for (const [field, value] of Object.entries(filters)) {
    query = query.eq(field, value);
  }
  const { data, error } = await query.select("*").maybeSingle();
  if (error) {
    if (error.code === "22P02") {
      return inputError(action, "The requested identifier is invalid.", { identifier });
    }
    if (error.code === "PGRST116") {
      return inputError(action, "The requested record is ambiguous.", { identifier });
    }
    return actionError(action, error);
  }
  if (!data) {
    return inputError(action, "The requested record was not found in this facility.", { identifier });
  }
  return data as Row;
}

function numberWithin(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export async function executeSafeAction(
  client: SupabaseClient,
  action: ActionName,
  argumentsObject: ActionArguments,
  facilityId: string,
): Promise<unknown> {
  if (typeof facilityId !== "string" || facilityId.trim().length === 0) {
    throw new MiloError("AUTHENTICATION_FAILED", 401, "A facility session is required.");
  }

  const scopedFacilityId = facilityId.trim();

  switch (action) {
    case "get_dashboard_summary": {
      const [facilityResult, inventory, patientMetrics, beds, attendance, tests, alerts, tasks] =
        await Promise.all([
          client.from("facilities").select("*").eq("id", scopedFacilityId).maybeSingle(),
          readScopedTable(client, "inventory_items", scopedFacilityId, action),
          readScopedTable(client, "patient_metrics", scopedFacilityId, action),
          readScopedTable(client, "bed_status", scopedFacilityId, action),
          readScopedTable(client, "staff_attendance", scopedFacilityId, action),
          readScopedTable(client, "test_availability", scopedFacilityId, action),
          readScopedTable(client, "alerts", scopedFacilityId, action),
          readScopedTable(client, "tasks", scopedFacilityId, action),
        ]);

      if (facilityResult.error) return actionError(action, facilityResult.error);
      if (!facilityResult.data) {
        return inputError(action, "The current facility was not found.", { facilityId: scopedFacilityId });
      }

      return {
        facility: facilityResult.data,
        inventory_items: inventory,
        patient_metrics: patientMetrics,
        bed_status: beds,
        staff_attendance: attendance,
        test_availability: tests,
        alerts,
        tasks,
      };
    }

    case "list_low_stock_items": {
      const items = await readScopedTable(client, "inventory_items", scopedFacilityId, action);
      const threshold = argumentsObject.threshold;
      return items.filter((item) => {
        const currentStock = item.current_stock;
        const reorderLevel = item.reorder_level;
        if (typeof currentStock !== "number" || typeof reorderLevel !== "number") return false;
        return currentStock <= (typeof threshold === "number" ? threshold : reorderLevel);
      });
    }

    case "add_inventory_item": {
      const itemName = stringArgument(argumentsObject, action, "item_name");
      const unit = stringArgument(argumentsObject, action, "unit");
      const quantity = argumentsObject.quantity;
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
        return inputError(action, "Quantity must be a finite non-negative number.", { field: "quantity" });
      }

      const payload: Row = {
        facility_id: scopedFacilityId,
        name: itemName,
        unit,
        current_stock: quantity,
      };
      if (typeof argumentsObject.reorder_level === "number") {
        payload.reorder_level = argumentsObject.reorder_level;
      }

      const item = await insertRow(client, "inventory_items", payload, action);
      await writeAudit(client, scopedFacilityId, action, "inventory_items", String(item.id), {
        item_name: itemName,
        quantity,
      });
      return item;
    }

    case "update_inventory_stock": {
      const itemId = stringArgument(argumentsObject, action, "item_id");
      const quantity = argumentsObject.quantity;
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
        return inputError(action, "Quantity must be a finite non-negative number.", { field: "quantity" });
      }

      await readSingle(client, "inventory_items", { id: itemId, facility_id: scopedFacilityId }, action, itemId);
      const item = await updateRow(
        client,
        "inventory_items",
        { id: itemId, facility_id: scopedFacilityId },
        { current_stock: quantity, updated_at: new Date().toISOString() },
        action,
        itemId,
      );
      await writeAudit(client, scopedFacilityId, action, "inventory_items", itemId, {
        quantity,
        ...(typeof argumentsObject.reason === "string" && argumentsObject.reason.trim()
          ? { reason: argumentsObject.reason.trim() }
          : {}),
      });
      return item;
    }

    case "record_patient_footfall": {
      const count = argumentsObject.count;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
        return inputError(action, "Count must be a non-negative integer.", { field: "count" });
      }
      const metricDate = dateArgument(argumentsObject.recorded_on, action, "recorded_on", todayUtc());
      const existingQuery = await client
        .from("patient_metrics")
        .select("*")
        .eq("facility_id", scopedFacilityId)
        .eq("metric_date", metricDate)
        .maybeSingle();
      if (existingQuery.error) {
        if (existingQuery.error.code === "PGRST116") {
          return inputError(action, "More than one patient metric exists for that date.", {
            recorded_on: metricDate,
          });
        }
        return actionError(action, existingQuery.error);
      }

      const metric = existingQuery.data
        ? await updateRow(
            client,
            "patient_metrics",
            { id: String(existingQuery.data.id), facility_id: scopedFacilityId },
            { outpatient_count: count },
            action,
            metricDate,
          )
        : await insertRow(
            client,
            "patient_metrics",
            {
              facility_id: scopedFacilityId,
              metric_date: metricDate,
              outpatient_count: count,
              inpatient_count: 0,
              emergency_count: 0,
            },
            action,
          );
      await writeAudit(client, scopedFacilityId, action, "patient_metrics", String(metric.id), {
        metric_date: metricDate,
        outpatient_count: count,
      });
      return metric;
    }

    case "update_bed_status": {
      const bedId = stringArgument(argumentsObject, action, "bed_id");
      const status = stringArgument(argumentsObject, action, "status").toLowerCase();
      if (!BED_STATUSES.has(status)) {
        return inputError(action, "Bed status must be available, occupied, or maintenance.", {
          field: "status",
        });
      }

      const bed = await readSingle(client, "bed_status", { id: bedId, facility_id: scopedFacilityId }, action, bedId);
      const totalBeds = asSafeNumber(bed, "total_beds", action);
      const currentOccupied = asSafeNumber(bed, "occupied_beds", action);
      const currentAvailable = asSafeNumber(bed, "available_beds", action);
      const boundedTotal = Math.floor(totalBeds);
      let occupiedBeds = numberWithin(Math.floor(currentOccupied), 0, boundedTotal);
      let availableBeds = numberWithin(
        Math.floor(currentAvailable),
        0,
        Math.max(0, boundedTotal - occupiedBeds),
      );

      if (status === "available") {
        occupiedBeds = Math.max(0, occupiedBeds - 1);
        availableBeds = Math.min(boundedTotal - occupiedBeds, availableBeds + 1);
      } else if (status === "occupied") {
        occupiedBeds = Math.min(boundedTotal, occupiedBeds + 1);
        availableBeds = Math.min(
          Math.max(0, boundedTotal - occupiedBeds),
          Math.max(0, availableBeds - 1),
        );
      } else {
        throw new MiloError(
          "SCHEMA_UNSUPPORTED",
          422,
          "Maintenance status cannot be stored because bed_status has no maintenance column.",
          { action },
        );
      }

      const updatedBed = await updateRow(
        client,
        "bed_status",
        { id: bedId, facility_id: scopedFacilityId },
        {
          occupied_beds: occupiedBeds,
          updated_at: new Date().toISOString(),
        },
        action,
        bedId,
      );
      await writeAudit(client, scopedFacilityId, action, "bed_status", bedId, {
        status,
        occupied_beds: occupiedBeds,
        available_beds: availableBeds,
      });
      return updatedBed;
    }

    case "record_staff_attendance": {
      const staffId = stringArgument(argumentsObject, action, "staff_id");
      const status = stringArgument(argumentsObject, action, "status");
      const payload: Row = { status };
      if (argumentsObject.attendance_date !== undefined) {
        payload.attendance_date = dateArgument(argumentsObject.attendance_date, action, "attendance_date");
      }
      const staff = await readSingle(
        client,
        "staff_attendance",
        { id: staffId, facility_id: scopedFacilityId },
        action,
        staffId,
      );
      const updatedStaff = await updateRow(
        client,
        "staff_attendance",
        { id: staffId, facility_id: scopedFacilityId },
        payload,
        action,
        staffId,
      );
      await writeAudit(client, scopedFacilityId, action, "staff_attendance", staffId, {
        status,
        ...(payload.attendance_date ? { attendance_date: payload.attendance_date } : {}),
        staff_name: staff.staff_name,
      });
      return updatedStaff;
    }

    case "update_test_availability": {
      const testId = stringArgument(argumentsObject, action, "test_id");
      const available = argumentsObject.available;
      if (typeof available !== "boolean") {
        return inputError(action, "Availability must be a boolean.", { field: "available" });
      }
      await readSingle(client, "test_availability", { id: testId, facility_id: scopedFacilityId }, action, testId);
      const test = await updateRow(
        client,
        "test_availability",
        { id: testId, facility_id: scopedFacilityId },
        { is_available: available, updated_at: new Date().toISOString() },
        action,
        testId,
      );
      await writeAudit(client, scopedFacilityId, action, "test_availability", testId, {
        is_available: available,
        ...(typeof argumentsObject.reason === "string" && argumentsObject.reason.trim()
          ? { reason: argumentsObject.reason.trim() }
          : {}),
      });
      return test;
    }

    case "create_alert": {
      const title = stringArgument(argumentsObject, action, "title");
      const message = stringArgument(argumentsObject, action, "message");
      const severity = stringArgument(argumentsObject, action, "severity");
      const alert = await insertRow(
        client,
        "alerts",
        {
          facility_id: scopedFacilityId,
          alert_type: title,
          severity,
          message,
          status: "open",
        },
        action,
      );
      await writeAudit(client, scopedFacilityId, action, "alerts", String(alert.id), {
        title,
        severity,
      });
      return alert;
    }

    case "create_task": {
      const title = stringArgument(argumentsObject, action, "title");
      const payload: Row = { facility_id: scopedFacilityId, title };
      if (typeof argumentsObject.description === "string" && argumentsObject.description.trim()) {
        payload.description = argumentsObject.description.trim();
      }
      if (argumentsObject.due_date !== undefined) {
        payload.due_date = dateArgument(argumentsObject.due_date, action, "due_date");
      }

      const task = await insertRow(client, "tasks", payload, action);
      await writeAudit(client, scopedFacilityId, action, "tasks", String(task.id), {});
      return task;
    }
  }
}

export function actionDefinitionsForGemini(): Record<ActionName, ActionDefinition> {
  return ACTION_DEFINITIONS;
}
