import LottieVisual from "@/components/LottieVisual";
import type { DemoRole } from "@/app/page";

type LoginScreenProps = {
  selectedRole: DemoRole;
  onSelectRole: (role: DemoRole) => void;
  onGuestLogin: () => void;
};

const roles: Array<{ id: DemoRole; title: string; detail: string; icon: string; animation: string }> = [
  { id: "admin", title: "Admin", detail: "District Command Center", icon: "⌁", animation: "admin.json" },
  { id: "manager", title: "Health Centre Manager", detail: "Manage one PHC or CHC", icon: "▦", animation: "health-centre-manager.json" },
  { id: "worker", title: "Health Worker", detail: "Frontline operator", icon: "♧", animation: "health-worker.json" },
];

export default function LoginScreen({ selectedRole, onSelectRole, onGuestLogin }: LoginScreenProps) {
  const selected = roles.find((role) => role.id === selectedRole) ?? roles[0];

  return (
    <main className="login-shell">
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-mark brand-mark-large">+</span>
          <span><strong>SwaPulse <em>AI</em></strong><small>People · Health · Stronger Districts</small></span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">EVIDENCE → ACTION</p>
          <h1>Healthier <span>communities</span><br />with smarter care.</h1>
          <p>One calm control room for stock, beds, people, tests, and the frontline updates that keep a district moving.</p>
        </div>
        <div className="story-visual">
          <div className="visual-grid" />
          <div className="visual-ring visual-ring-one" />
          <div className="visual-ring visual-ring-two" />
          <div className="selection-burst" key={selectedRole} />
          <LottieVisual key={selectedRole} className="login-animation" src={`/animations/roles/${selected.animation}`} ariaLabel={`${selected.title} animation`} />
          <div className="selected-role-label"><span className="chip-dot" />{selected.title} workspace</div>
          <div className="visual-chip visual-chip-top"><span className="chip-dot" />12 centres synced</div>
          <div className="visual-chip visual-chip-bottom"><span className="chip-spark">✦</span> AI action ready</div>
        </div>
        <div className="story-footer"><span>Built for PHCs & CHCs</span><span className="footer-line" /><span>Powered by evidence</span></div>
      </section>

      <section className="login-card" aria-labelledby="login-title">
        <button className="guest-top-button" onClick={onGuestLogin} type="button">
          <span className="guest-recommended">RECOMMENDED</span><span className="guest-icon">♙</span> Login as a Guest <span className="arrow">→</span>
        </button>
        <div className="login-card-inner">
          <p className="eyebrow">WELCOME BACK</p>
          <h2 id="login-title">Sign in to your<br /><span>health network.</span></h2>
          <p className="login-subtitle">Choose your workspace to continue.</p>

          <div className="role-grid" aria-label="Choose a workspace role">
            {roles.map((item) => (
              <button
                aria-pressed={selectedRole === item.id}
                className={`role-card ${selectedRole === item.id ? "selected" : ""}`}
                key={item.id}
                onClick={() => onSelectRole(item.id)}
                type="button"
              >
                <span className="role-icon">{item.icon}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>

          <div className="login-divider"><span>secure sign in</span></div>
          <label className="field"><span className="field-icon">@</span><input aria-label="Email or username" placeholder="Email / Username" type="email" /></label>
          <label className="field"><span className="field-icon">⌑</span><input aria-label="Password" placeholder="Password" type="password" /><button aria-label="Show password" className="field-action" type="button">◉</button></label>
          <div className="form-meta"><span>Demo mode is ready</span><button type="button">Forgot password?</button></div>
          <button className="sign-in-button" onClick={onGuestLogin} type="button">Enter demo workspace <span>→</span></button>
          <p className="login-note">No real patient data · safe hackathon demo</p>
        </div>
      </section>
    </main>
  );
}
