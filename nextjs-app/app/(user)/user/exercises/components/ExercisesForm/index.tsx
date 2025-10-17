"use client";

import { useState } from "react";

export default function ExerciseForm({
  onExerciseAdded,
}: {
  onExerciseAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setName("");
    setDescription("");
    setLoading(false);
    if (onExerciseAdded) onExerciseAdded(); // odśwież listę ćwiczeń
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <input
        required
        placeholder="Nazwa ćwiczenia"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <input
        placeholder="Opis (opcjonalnie)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <button type="submit" disabled={loading}>
        Dodaj ćwiczenie
      </button>
    </form>
  );
}
