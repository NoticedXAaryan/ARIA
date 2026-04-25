export default function HistoryTab({ history }) {
  return (
    <div>
      <h2>History</h2>
      <ul>
        {history.map((item) => (
          <li key={item.id}>
            {item.suggestion_text} - {item.outcome || "pending"}
          </li>
        ))}
      </ul>
    </div>
  );
}
