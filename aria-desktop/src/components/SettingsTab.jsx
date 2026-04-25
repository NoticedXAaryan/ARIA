import { useState } from "react";

export default function SettingsTab() {
  const [notesPath, setNotesPath] = useState("");
  const [maxNudges, setMaxNudges] = useState(8);

  return (
    <div>
      <h2>Settings</h2>
      <label>
        Notes Path
        <input value={notesPath} onChange={(e) => setNotesPath(e.target.value)} />
      </label>
      <label>
        Max Nudges Per Day
        <input type="number" value={maxNudges} onChange={(e) => setMaxNudges(Number(e.target.value))} />
      </label>
    </div>
  );
}
