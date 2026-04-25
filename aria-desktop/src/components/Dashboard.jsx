import { useEffect, useState } from "react";
import TodayTab from "./TodayTab";
import HistoryTab from "./HistoryTab";
import HabitsTab from "./HabitsTab";
import SettingsTab from "./SettingsTab";
import { useNudges } from "../hooks/useNudges";
import { useSchedule } from "../hooks/useSchedule";

export default function Dashboard() {
  const [tab, setTab] = useState("today");
  const [history, setHistory] = useState([]);
  const [habits, setHabits] = useState([]);
  const nudgesQuery = useNudges();
  const scheduleQuery = useSchedule();

  useEffect(() => {
    fetch("http://127.0.0.1:8742/api/nudges/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.items || []));
    fetch("http://127.0.0.1:8742/api/habits")
      .then((r) => r.json())
      .then(setHabits);
  }, []);

  const tabs = {
    today: <TodayTab schedule={scheduleQuery.data || []} nudges={nudgesQuery.data || []} />,
    history: <HistoryTab history={history} />,
    habits: <HabitsTab habits={habits} />,
    settings: <SettingsTab />
  };

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
      <h1>ARIA</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setTab("today")}>Today</button>
        <button onClick={() => setTab("history")}>History</button>
        <button onClick={() => setTab("habits")}>Habits</button>
        <button onClick={() => setTab("settings")}>Settings</button>
      </div>
      {tabs[tab]}
    </div>
  );
}
