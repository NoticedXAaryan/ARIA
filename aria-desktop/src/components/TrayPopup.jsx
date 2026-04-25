export default function TrayPopup({ nudge }) {
  if (!nudge) return null;
  return (
    <div style={{ borderLeft: "6px solid #ef4444", padding: 12, background: "white" }}>
      <strong>ARIA</strong>
      <p style={{ margin: "6px 0" }}>{nudge.text}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button>Accept</button>
        <button>Snooze</button>
        <button>Dismiss</button>
      </div>
    </div>
  );
}
