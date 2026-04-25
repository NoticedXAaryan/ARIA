export default function HabitsTab({ habits }) {
  return (
    <div>
      <h2>Habits</h2>
      <ul>
        {habits.map((h, idx) => (
          <li key={idx}>{h.habit_type} ({Math.round((h.confidence || 0) * 100)}%)</li>
        ))}
      </ul>
    </div>
  );
}
