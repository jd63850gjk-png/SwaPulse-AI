"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DemoRole } from "@/app/page";

type GuestDashboardProps = { role: DemoRole; onSwitchRole: (role: DemoRole) => void; onExit: () => void };

const roleLabels: Record<DemoRole, string> = {
  admin: "District Command Center",
  manager: "Health Centre Manager",
  worker: "Health Worker Operator",
};

type DataRow = Record<string, unknown>;

type DashboardSummary = {
  facility: DataRow;
  inventory_items: DataRow[];
  patient_metrics: DataRow[];
  bed_status: DataRow[];
  staff_attendance: DataRow[];
  test_availability: DataRow[];
  alerts: DataRow[];
  tasks: DataRow[];
};

type MiloErrorPayload = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type MiloResponse = {
  ok: boolean;
  action?: { name?: string; arguments?: Record<string, unknown> };
  data?: unknown;
  text?: string;
  facility?: string;
  error?: MiloErrorPayload;
};

type MiloMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actionName?: string;
  data?: unknown;
  error?: MiloErrorPayload;
};

type MiloClientError = MiloErrorPayload;

type MiloRequestBody =
  | { message: string }
  | { action: string; args: Record<string, unknown> }
  | { message: string; image: { mimeType: string; data: string } };

type PulseRow = {
  name: string;
  status: string;
  tone: "good" | "warning" | "neutral";
  detail: string;
};

type ActivityRow = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  timestamp?: string;
};

const EMPTY_SUMMARY: DashboardSummary = {
  facility: {},
  inventory_items: [],
  patient_metrics: [],
  bed_status: [],
  staff_attendance: [],
  test_availability: [],
  alerts: [],
  tasks: [],
};

function asRecord(value: unknown): DataRow {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DataRow)
    : {};
}

function asRows(value: unknown): DataRow[] {
  return Array.isArray(value) ? value.map(asRecord).filter((row) => Object.keys(row).length > 0) : [];
}

function fieldString(row: DataRow | undefined, ...fields: string[]): string | undefined {
  if (!row) return undefined;
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return undefined;
}

function fieldNumber(row: DataRow | undefined, ...fields: string[]): number | undefined {
  if (!row) return undefined;
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? "—" : new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string | undefined): string {
  if (!value) return "Live data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(parsed);
}

function relativeTime(value: string | undefined): string {
  if (!value) return "Recently returned";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Recently returned";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function actionLabel(actionName: string): string {
  return actionName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function prettyData(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "No structured data returned.";
  } catch {
    return "The response could not be displayed.";
  }
}

function normalizeSummary(value: unknown): DashboardSummary {
  const row = asRecord(value);
  return {
    facility: asRecord(row.facility),
    inventory_items: asRows(row.inventory_items),
    patient_metrics: asRows(row.patient_metrics),
    bed_status: asRows(row.bed_status),
    staff_attendance: asRows(row.staff_attendance),
    test_availability: asRows(row.test_availability),
    alerts: asRows(row.alerts),
    tasks: asRows(row.tasks),
  };
}

function errorFromUnknown(error: unknown): MiloClientError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<MiloErrorPayload>;
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return { code: candidate.code, message: candidate.message, details: candidate.details };
    }
  }
  return { code: "NETWORK_ERROR", message: "Milo could not reach the data service. Try again." };
}

async function imagePayload(file: File): Promise<{ mimeType: string; data: string }> {
  if (file.size > 5 * 1024 * 1024) {
    throw { code: "IMAGE_TOO_LARGE", message: "Choose an image smaller than 5 MB." } satisfies MiloClientError;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });

  const separator = dataUrl.indexOf(",");
  if (separator < 0) {
    throw { code: "IMAGE_INVALID", message: "The selected image could not be prepared." } satisfies MiloClientError;
  }

  return { mimeType: file.type, data: dataUrl.slice(separator + 1) };
}

async function requestMilo(init: RequestInit = {}): Promise<MiloResponse> {
  let response: Response;
  try {
    response = await fetch("/api/milo", {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw errorFromUnknown(undefined);
  }

  let payload: MiloResponse;
  try {
    payload = (await response.json()) as MiloResponse;
  } catch {
    throw { code: "INVALID_RESPONSE", message: "Milo returned an unreadable response." } satisfies MiloClientError;
  }

  if (!response.ok || payload.ok !== true) {
    throw payload.error ?? { code: "REQUEST_FAILED", message: "Milo could not complete that request." };
  }
  return payload;
}

function sumPatientCounts(metrics: DataRow[]): { value?: number; date?: string } {
  if (metrics.length === 0) return {};
  const sorted = [...metrics].sort((left, right) => {
    const leftDate = fieldString(left, "metric_date", "recorded_on", "created_at") ?? "";
    const rightDate = fieldString(right, "metric_date", "recorded_on", "created_at") ?? "";
    return rightDate.localeCompare(leftDate);
  });
  const latestDate = fieldString(sorted[0], "metric_date", "recorded_on", "created_at");
  const latest = sorted.filter((metric) => {
    const date = fieldString(metric, "metric_date", "recorded_on", "created_at");
    return !latestDate || date === latestDate;
  });
  const values = latest.flatMap((metric) =>
    ["outpatient_count", "inpatient_count", "emergency_count", "patient_count", "count"]
      .map((field) => fieldNumber(metric, field))
      .filter((value): value is number => value !== undefined),
  );
  return { value: values.length > 0 ? values.reduce((total, count) => total + count, 0) : undefined, date: latestDate };
}

function createActivity(summary: DashboardSummary): ActivityRow[] {
  const activities: Array<ActivityRow & { sortValue: string }> = [];

  summary.alerts.forEach((alert, index) => {
    activities.push({
      id: `alert-${fieldString(alert, "id") ?? index}`,
      icon: "!",
      title: fieldString(alert, "alert_type", "title") ?? "Operational alert",
      detail: fieldString(alert, "message", "description") ?? "Review the latest facility alert.",
      timestamp: fieldString(alert, "created_at", "updated_at"),
      sortValue: fieldString(alert, "created_at", "updated_at") ?? "",
    });
  });

  summary.tasks.forEach((task, index) => {
    activities.push({
      id: `task-${fieldString(task, "id") ?? index}`,
      icon: "↗",
      title: fieldString(task, "title") ?? "Follow-up task",
      detail: fieldString(task, "status") ? `Status: ${fieldString(task, "status")}` : "Task created for this facility",
      timestamp: fieldString(task, "created_at", "updated_at"),
      sortValue: fieldString(task, "created_at", "updated_at") ?? "",
    });
  });

  summary.inventory_items.forEach((item, index) => {
    const name = fieldString(item, "name", "item_name") ?? "Inventory item";
    const stock = fieldNumber(item, "current_stock", "quantity");
    const unit = fieldString(item, "unit") ?? "units";
    activities.push({
      id: `inventory-${fieldString(item, "id") ?? index}`,
      icon: "▣",
      title: "Inventory tracked",
      detail: `${name} · ${stock === undefined ? "Quantity unavailable" : `${formatNumber(stock)} ${unit}`}`,
      timestamp: fieldString(item, "updated_at", "created_at"),
      sortValue: fieldString(item, "updated_at", "created_at") ?? "",
    });
  });

  const patientTotals = sumPatientCounts(summary.patient_metrics);
  if (patientTotals.value !== undefined) {
    activities.push({
      id: "patients-latest",
      icon: "+",
      title: "Patient metric recorded",
      detail: `${formatNumber(patientTotals.value)} patients · ${formatDate(patientTotals.date)}`,
      timestamp: patientTotals.date,
      sortValue: patientTotals.date ?? "",
    });
  }

  return activities.sort((left, right) => right.sortValue.localeCompare(left.sortValue)).slice(0, 5);
}

export default function GuestDashboard({ role, onSwitchRole, onExit }: GuestDashboardProps) {
  const [command, setCommand] = useState("");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [messages, setMessages] = useState<MiloMessage[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastAction, setLastAction] = useState("Connecting to the live demo facility…");
  const [pageError, setPageError] = useState<MiloClientError | null>(null);
  const [inventoryError, setInventoryError] = useState<MiloClientError | null>(null);
  const [inventoryForm, setInventoryForm] = useState({ itemName: "", unit: "", quantity: "", reorderLevel: "" });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState<MiloClientError | null>(null);

  const view = useMemo(() => {
    const current = summary ?? EMPTY_SUMMARY;
    const facilityName = fieldString(current.facility, "name", "facility_name", "title", "code") ?? "Demo health facility";
    const facilityLocation = fieldString(current.facility, "district", "location", "address");
    const lowStock = current.inventory_items.filter((item) => {
      const stock = fieldNumber(item, "current_stock", "quantity");
      const reorder = fieldNumber(item, "reorder_level");
      return stock !== undefined && reorder !== undefined && stock <= reorder;
    });
    const openAlerts = current.alerts.filter((alert) => {
      const status = fieldString(alert, "status")?.toLowerCase();
      return !status || !["closed", "resolved", "done"].includes(status);
    });
    const patients = sumPatientCounts(current.patient_metrics);
    const availableBeds = current.bed_status.reduce((total, bed) => total + (fieldNumber(bed, "available_beds") ?? 0), 0);
    const totalBeds = current.bed_status.reduce((total, bed) => total + (fieldNumber(bed, "total_beds") ?? 0), 0);
    const pulseRows: PulseRow[] = [
      {
        name: facilityName,
        status: openAlerts.length > 0 ? "Review alerts" : "Live",
        tone: openAlerts.length > 0 ? "warning" : "good",
        detail: `${lowStock.length} low-stock risk${lowStock.length === 1 ? "" : "s"} · ${openAlerts.length} open alert${openAlerts.length === 1 ? "" : "s"}`,
      },
      ...lowStock.slice(0, 2).map((item) => {
        const name = fieldString(item, "name", "item_name") ?? "Inventory item";
        const stock = fieldNumber(item, "current_stock", "quantity");
        const reorder = fieldNumber(item, "reorder_level");
        const unit = fieldString(item, "unit") ?? "units";
        return {
          name,
          status: "Stock risk" as const,
          tone: "warning" as const,
          detail: `${formatNumber(stock)} ${unit} remaining · reorder at ${formatNumber(reorder)}`,
        };
      }),
    ];

    if (pulseRows.length === 1 && current.tasks.length > 0) {
      const task = current.tasks[0];
      pulseRows.push({
        name: fieldString(task, "title") ?? "Open follow-up",
        status: "Action due",
        tone: "neutral",
        detail: fieldString(task, "description") ?? "A follow-up task is waiting for review.",
      });
    }

    return {
      facilityName,
      facilityLocation,
      lowStock,
      openAlerts,
      patients,
      availableBeds: current.bed_status.length > 0 ? availableBeds : undefined,
      totalBeds: current.bed_status.length > 0 ? totalBeds : undefined,
      pulseRows: pulseRows.slice(0, 3),
      activities: createActivity(current),
      metrics: [
        { label: "Facilities online", value: summary ? "1 / 1" : "—", note: facilityLocation ?? "Anonymous demo session", tone: "" },
        { label: "Patients recorded", value: formatNumber(patients.value), note: patients.date ? `Latest · ${formatDate(patients.date)}` : "Waiting for a patient metric", tone: "positive" },
        { label: "Stock-out risks", value: formatNumber(lowStock.length), note: lowStock.length > 0 ? "Needs review" : "All tracked items above reorder", tone: lowStock.length > 0 ? "negative" : "positive" },
        { label: "Beds available", value: formatNumber(current.bed_status.length > 0 ? availableBeds : undefined), note: totalBeds > 0 ? `Across ${formatNumber(totalBeds)} total beds` : "No bed board returned", tone: "" },
      ],
    };
  }, [summary]);

  async function loadDashboard(announce = false) {
    setIsRefreshing(true);
    setPageError(null);
    try {
      await requestMilo({ method: "GET" });
      const response = await requestMilo({
        method: "POST",
        body: JSON.stringify({ action: "get_dashboard_summary", args: {} }),
      });
      const nextSummary = normalizeSummary(response.data);
      setSummary(nextSummary);
      const facilityName = fieldString(nextSummary.facility, "name", "facility_name", "title", "code") ?? "demo facility";
      setLastAction(`Live data refreshed · ${facilityName}`);
      if (announce) {
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-refresh`,
            role: "assistant",
            text: "The dashboard is up to date with the latest facility data.",
            actionName: "get_dashboard_summary",
            data: nextSummary,
          },
        ]);
      }
    } catch (error) {
      const nextError = errorFromUnknown(error);
      setPageError(nextError);
      setLastAction(`Could not refresh · ${nextError.code}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function sendRequest(
    requestBody: MiloRequestBody,
    userText: string,
    onSuccess?: (response: MiloResponse) => void,
  ) {
    if (isBusy) return;
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: "user", text: userText }]);
    setPageError(null);
    setIsBusy(true);
    try {
      const response = await requestMilo({ method: "POST", body: JSON.stringify(requestBody) });
      const actionName = response.action?.name;
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: response.text ?? (actionName ? `${actionLabel(actionName)} completed successfully.` : "Milo is ready to help."),
          actionName,
          data: response.data,
        },
      ]);
      setLastAction(response.text ? "Milo answered · just now" : `${actionLabel(actionName ?? "request")} completed · just now`);
      onSuccess?.(response);
    } catch (error) {
      const nextError = errorFromUnknown(error);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: nextError.message,
          error: nextError,
        },
      ]);
      setLastAction(`Action needs attention · ${nextError.code}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEvidenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidenceFile || isBusy) return;

    setEvidenceError(null);
    try {
      const image = await imagePayload(evidenceFile);
      const fileName = evidenceFile.name;
      setEvidenceFile(null);
      await sendRequest(
        {
          message: "Inspect this healthcare register or facility evidence image and record the safest operational update.",
          image,
        },
        `Analyze image: ${fileName}`,
        () => void loadDashboard(),
      );
    } catch (error) {
      setEvidenceError(errorFromUnknown(error));
    }
  }

  function runDemoAction() {
    const trimmed = command.trim();
    if (!trimmed || isBusy) return;
    setCommand("");
    void sendRequest({ message: trimmed }, trimmed, (response) => {
      if (response.action?.name === "get_dashboard_summary") setSummary(normalizeSummary(response.data));
    });
  }

  function handleInventorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const itemName = inventoryForm.itemName.trim();
    const unit = inventoryForm.unit.trim();
    const quantity = Number(inventoryForm.quantity);
    const reorderLevel = inventoryForm.reorderLevel.trim() ? Number(inventoryForm.reorderLevel) : undefined;

    if (!itemName || !unit || !Number.isFinite(quantity) || quantity < 0 || (reorderLevel !== undefined && (!Number.isFinite(reorderLevel) || reorderLevel < 0))) {
      setInventoryError({ code: "INVALID_FORM", message: "Enter a name, unit, and non-negative quantity. Reorder level is optional but must be non-negative." });
      return;
    }

    setInventoryError(null);
    const args = {
      item_name: itemName,
      unit,
      quantity,
      ...(reorderLevel === undefined ? {} : { reorder_level: reorderLevel }),
    };
    void sendRequest({ action: "add_inventory_item", args }, `Add ${itemName} to inventory`, (response) => {
      setInventoryForm({ itemName: "", unit: "", quantity: "", reorderLevel: "" });
      if (response.data) {
        void loadDashboard();
      }
    });
  }

  return (
    <main className="shell dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">+</span><span><strong>SwaPulse <em>AI</em></strong><small>AI health operations control room</small></span></div>
        <div className="dashboard-tools"><div className="demo-badge">Guest demo · {roleLabels[role]}</div><button className="exit-button" onClick={onExit} type="button">Exit guest</button></div>
      </header>
      <nav className="role-switcher" aria-label="Switch demo profile">
        <span className="switcher-label">VIEW AS</span>
        {(Object.keys(roleLabels) as DemoRole[]).map((item) => <button className={role === item ? "active" : ""} key={item} onClick={() => onSwitchRole(item)} type="button">{roleLabels[item]}</button>)}
      </nav>

      <section className="dashboard-hero">
        <div><p className="eyebrow">{roleLabels[role].toUpperCase()}</p><h1>Good morning, <span>district.</span></h1><p className="hero-copy">Your shared health network is live. Ask Milo to find a risk, process an update, or prepare the next action.</p><div className="hero-live-note"><span className="result-dot" />{summary ? `Live view · ${view.facilityName}` : "Connecting to live facility data…"}</div></div>
        <aside className="command-card command-card-live milo-card" aria-labelledby="milo-title">
          <div className="milo-card-header"><div className="milo-heading"><span className="milo-orb">✦</span><div><div className="card-label" id="milo-title">MILO · ACTION DESK</div><small>Safe actions over live Supabase data</small></div></div><span className="live-pill">LIVE</span></div>
          <div className="milo-thread" aria-live="polite">
            {messages.length === 0 && <div className="milo-empty"><strong>Ask Milo about this facility</strong><span>Try “Which supplies are running low?”</span></div>}
            {messages.slice(-3).map((message) => (
              <div className={`milo-message ${message.role} ${message.error ? "has-error" : ""}`} key={message.id}>
                <span className="milo-message-label">{message.role === "user" ? "You" : "Milo"}</span>
                <p>{message.text}</p>
                {message.actionName && <details className="milo-result"><summary>{actionLabel(message.actionName)} result</summary><pre>{prettyData(message.data)}</pre></details>}
                {message.error && <div className="milo-structured-error"><strong>{message.error.code}</strong><span>{message.error.message}</span>{message.error.details && <pre>{prettyData(message.error.details)}</pre>}</div>}
              </div>
            ))}
            {isBusy && <div className="milo-message assistant milo-loading" role="status"><span className="milo-message-label">Milo</span><p><span className="loading-dot" /> Checking the facility…</p></div>}
          </div>
          <form className="command-input" onSubmit={(event) => { event.preventDefault(); runDemoAction(); }}>
            <input aria-label="Message Milo" disabled={isBusy} onChange={(event) => setCommand(event.target.value)} placeholder="Ask Milo to check or update…" value={command} />
            <button aria-label="Send message to Milo" disabled={isBusy || !command.trim()} type="submit">↗</button>
          </form>
          <small className="command-status">{lastAction}</small>
        </aside>
      </section>

      {pageError && <div className="dashboard-alert" role="alert"><div><strong>{pageError.code}</strong><span>{pageError.message}</span>{pageError.details && <pre>{prettyData(pageError.details)}</pre>}</div><button className="text-button" onClick={() => void loadDashboard()} type="button">Try again</button></div>}

      <section className="metrics" aria-label="Live facility overview">
        {view.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small className={metric.tone}>{metric.note}</small></article>)}
      </section>

      <section className="workspace-grid">
        <div className="panel"><div className="panel-heading"><div><p className="eyebrow">FACILITY PULSE</p><h2>What needs attention</h2></div><button className="refresh-button" disabled={isRefreshing} onClick={() => void loadDashboard(true)} type="button">{isRefreshing ? "Refreshing…" : "↻ Refresh"}</button></div><div className="centre-list">{view.pulseRows.length > 0 ? view.pulseRows.map((pulse) => <div className="centre-row" key={`${pulse.name}-${pulse.status}`}><span className={`status-dot ${pulse.tone}`} /><div><strong>{pulse.name}</strong><small>{pulse.detail}</small></div><span className={`status-text ${pulse.tone}`}>{pulse.status}</span></div>) : <div className="empty-row">No facility records returned yet.</div>}</div></div>
        <div className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">AI ACTION LOG</p><h2>Recent activity</h2></div><span className="live-pill">LIVE</span></div><ul className="activity-list">{view.activities.length > 0 ? view.activities.map((activity) => <li key={activity.id}><span className="activity-icon">{activity.icon}</span><div><strong>{activity.title}</strong><small>{activity.detail} · {relativeTime(activity.timestamp)}</small></div></li>) : <li className="empty-activity">No activity returned yet. Ask Milo for a live summary.</li>}</ul></div>
      </section>

       <section className="dashboard-lower-grid">
         <div className="panel inventory-panel"><div className="panel-heading"><div><p className="eyebrow">MANUAL UPDATE</p><h2>Add inventory item</h2></div><span className="action-badge">SAFE ACTION</span></div><p className="panel-copy">Use the same validated <code>add_inventory_item</code> action as Milo when you already know the stock details.</p><form className="inventory-form" onSubmit={handleInventorySubmit}><label><span>Name</span><input aria-label="Inventory item name" onChange={(event) => setInventoryForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="ORS packets" value={inventoryForm.itemName} /></label><label><span>Unit</span><input aria-label="Inventory unit" onChange={(event) => setInventoryForm((current) => ({ ...current, unit: event.target.value }))} placeholder="packets" value={inventoryForm.unit} /></label><label><span>Quantity</span><input aria-label="Inventory quantity" min="0" onChange={(event) => setInventoryForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" step="any" type="number" value={inventoryForm.quantity} /></label><label><span>Reorder level <small>(optional)</small></span><input aria-label="Inventory reorder level" min="0" onChange={(event) => setInventoryForm((current) => ({ ...current, reorderLevel: event.target.value }))} placeholder="0" step="any" type="number" value={inventoryForm.reorderLevel} /></label><button className="primary inventory-submit" disabled={isBusy} type="submit">{isBusy ? "Saving…" : "Add item"} <span>→</span></button></form>{inventoryError && <div className="form-error" role="alert"><strong>{inventoryError.code}</strong><span>{inventoryError.message}</span></div>}</div>
         <form className="evidence-note" onSubmit={handleEvidenceSubmit}><span className="evidence-icon">▧</span><div><p className="eyebrow">EVIDENCE INPUT</p><h2>Send an image to Milo</h2><p>Upload a register, stock sheet, or bed board. Milo will propose one validated operational update.</p><input accept="image/jpeg,image/png,image/webp" className="evidence-input" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} type="file" />{evidenceFile && <small className="evidence-file">{evidenceFile.name}</small>}{evidenceError && <div className="form-error" role="alert"><strong>{evidenceError.code}</strong><span>{evidenceError.message}</span></div>}<button className="secondary evidence-submit" disabled={!evidenceFile || isBusy} type="submit">{isBusy ? "Analyzing…" : "Analyze image"} <span>→</span></button></div></form>
       </section>
    </main>
  );
}
