export default function ExpandedPanel({ nudge }) {
  if (!nudge) return null;
  return (
    <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <h3>Urgent</h3>
      <p>{nudge.text}</p>
      <p>Reasoning and context tags are shown here.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button>Accept</button>
        <button>Snooze 15m</button>
        <button>Dismiss</button>
      </div>
    </section>
  );
}
