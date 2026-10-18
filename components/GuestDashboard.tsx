import { useState } from "react";
import type { DemoRole } from "@/app/page";

type GuestDashboardProps = { role: DemoRole; onSwitchRole: (role: DemoRole) => void; onExit: () => void };

const roleLabels: Record<DemoRole, string> = {
  admin: "District Command Center",
  manager: "Health Centre Manager",
  worker: "Health Worker Operator",
};

const centres = [
  { name: "PHC Rampur", status: "Needs attention", tone: "warning", detail: "ORS stock: 6 days left" },
  { name: "CHC Lakshmi Nagar", status: "Stable", tone: "good", detail: "14 beds available" },
  { name: "PHC Nandgaon", status: "Data update due", tone: "neutral", detail: "Last update: 2h ago" },
];

export default function GuestDashboard({ role, onSwitchRole, onExit }: GuestDashboardProps) {
  const [command, setCommand] = useState("");
  const [lastAction, setLastAction] = useState("Ready for a demo command");

  function runDemoAction() {
    if (!command.trim()) return;
    setLastAction(`Demo action queued: “${command.trim()}”`);
    setCommand("");
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
        <div><p className="eyebrow">{roleLabels[role].toUpperCase()}</p><h1>Good morning, <span>district.</span></h1><p className="hero-copy">Your shared health network is live. Ask the AI to find a risk, process an update, or prepare the next action.</p></div>
        <div className="command-card command-card-live"><div className="card-label">AI ACTION DESK · DEMO</div><p>“Which centre may run out of essential supplies in the next 7 days?”</p><div className="command-input"><input aria-label="Demo command" onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runDemoAction(); }} placeholder="Try your own command…" value={command} /><button aria-label="Run command" onClick={runDemoAction} type="button">↗</button></div><small className="command-status">{lastAction}</small></div>
      </section>

      <section className="metrics" aria-label="District overview"><article><span>Centres online</span><strong>12 / 14</strong><small>2 updates pending</small></article><article><span>Patients today</span><strong>1,284</strong><small className="positive">+12% vs yesterday</small></article><article><span>Stock-out risks</span><strong>04</strong><small className="negative">Needs review</small></article><article><span>Beds available</span><strong>38</strong><small>Across 6 centres</small></article></section>
      <section className="workspace-grid"><div className="panel"><div className="panel-heading"><div><p className="eyebrow">CENTRE PULSE</p><h2>What needs attention</h2></div><button className="text-button" type="button">View all</button></div><div className="centre-list">{centres.map((centre) => <div className="centre-row" key={centre.name}><span className={`status-dot ${centre.tone}`} /><div><strong>{centre.name}</strong><small>{centre.detail}</small></div><span className={`status-text ${centre.tone}`}>{centre.status}</span></div>)}</div></div><div className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">AI ACTION LOG</p><h2>Recent activity</h2></div><span className="live-pill">LIVE</span></div><ul className="activity-list"><li><span className="activity-icon">↗</span><div><strong>Stock update accepted</strong><small>PHC Rampur · 4 minutes ago</small></div></li><li><span className="activity-icon">!</span><div><strong>Transfer recommendation created</strong><small>ORS packets · awaiting approval</small></div></li><li><span className="activity-icon">▣</span><div><strong>Bed board image processed</strong><small>CHC Lakshmi Nagar · 12 minutes ago</small></div></li></ul></div></section>
    </main>
  );
}
