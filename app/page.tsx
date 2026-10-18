const centres = [
  { name: "PHC Rampur", status: "Needs attention", tone: "warning", detail: "ORS stock: 6 days left" },
  { name: "CHC Lakshmi Nagar", status: "Stable", tone: "good", detail: "14 beds available" },
  { name: "PHC Nandgaon", status: "Data update due", tone: "neutral", detail: "Last update: 2h ago" },
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">+</span>
          <span>
            <strong>SwaPulse AI</strong>
            <small>AI health operations control room</small>
          </span>
        </div>
        <div className="demo-badge">Guest demo · District Admin</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">EVIDENCE → ACTION</p>
          <h1>Turn frontline updates into a live health network.</h1>
          <p className="hero-copy">
            Upload a register, speak an update, or type a command. Gemini interprets it,
            Supabase keeps the system in sync, and every dashboard action keeps its evidence trail.
          </p>
          <div className="actions">
            <button className="primary">Open AI action inbox</button>
            <button className="secondary">Switch profile</button>
          </div>
        </div>
        <div className="command-card">
          <div className="card-label">TRY A COMMAND</div>
          <p>“Which centre may run out of essential supplies in the next 7 days?”</p>
          <div className="command-result">
            <span className="result-dot" />
            <span>3 centres analysed · 1 transfer recommended</span>
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="District overview">
        <article><span>Centres online</span><strong>12 / 14</strong><small>2 updates pending</small></article>
        <article><span>Patients today</span><strong>1,284</strong><small className="positive">+12% vs yesterday</small></article>
        <article><span>Stock-out risks</span><strong>04</strong><small className="negative">Needs review</small></article>
        <article><span>Beds available</span><strong>38</strong><small>Across 6 centres</small></article>
      </section>

      <section className="workspace-grid">
        <div className="panel">
          <div className="panel-heading"><div><p className="eyebrow">CENTRE PULSE</p><h2>What needs attention</h2></div><button className="text-button">View all</button></div>
          <div className="centre-list">
            {centres.map((centre) => (
              <div className="centre-row" key={centre.name}>
                <span className={`status-dot ${centre.tone}`} />
                <div><strong>{centre.name}</strong><small>{centre.detail}</small></div>
                <span className={`status-text ${centre.tone}`}>{centre.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel action-panel">
          <div className="panel-heading"><div><p className="eyebrow">AI ACTION LOG</p><h2>Recent activity</h2></div><span className="live-pill">LIVE</span></div>
          <ul className="activity-list">
            <li><span className="activity-icon">↗</span><div><strong>Stock update accepted</strong><small>PHC Rampur · 4 minutes ago</small></div></li>
            <li><span className="activity-icon">!</span><div><strong>Transfer recommendation created</strong><small>ORS packets · awaiting approval</small></div></li>
            <li><span className="activity-icon">▣</span><div><strong>Bed board image processed</strong><small>CHC Lakshmi Nagar · 12 minutes ago</small></div></li>
          </ul>
        </div>
      </section>
    </main>
  );
}
