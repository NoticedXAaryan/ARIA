export default function TodayTab({ schedule, nudges }) {
  return (
    <div>
      <h2>Today</h2>
      <p>Upcoming events: {schedule.length}</p>
      <p>Active nudges: {nudges.length}</p>
    </div>
  );
}
