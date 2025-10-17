"use client";

import { useState } from "react";

type Exercise = {
  id: string;
  name: string;
  description?: string;
};

export default function ExerciseList({
  exercises,
  loading,
  onExerciseUpdated,
  onExerciseDeleted,
}: {
  exercises: Exercise[];
  loading: boolean;
  onExerciseUpdated: () => void;
  onExerciseDeleted: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const handleEdit = (exercise: Exercise) => {
    setEditId(exercise.id);
    setEditName(exercise.name);
    setEditDescription(exercise.description || "");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    await fetch(`/api/exercises/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDescription }),
    });
    setEditLoading(false);
    setEditId(null);
    onExerciseUpdated();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Na pewno usunąć ćwiczenie?")) return;
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    onExerciseDeleted();
  };

  if (loading) return <p>Ładowanie...</p>;
  if (!exercises.length) return <p>Brak ćwiczeń. Dodaj pierwsze!</p>;

  return (
    <ul>
      {exercises.map((ex) =>
        editId === ex.id ? (
          <li key={ex.id}>
            <form onSubmit={handleEditSubmit} style={{ display: "inline" }}>
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ marginRight: 8 }}
              />
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={{ marginRight: 8 }}
              />
              <button type="submit" disabled={editLoading}>
                Zapisz
              </button>
              <button type="button" onClick={() => setEditId(null)}>
                Anuluj
              </button>
            </form>
          </li>
        ) : (
          <li key={ex.id}>
            <strong>{ex.name}</strong>
            {ex.description && <span> – {ex.description}</span>}
            <button style={{ marginLeft: 8 }} onClick={() => handleEdit(ex)}>
              Edytuj
            </button>
            <button
              style={{ marginLeft: 8, color: "red" }}
              onClick={() => handleDelete(ex.id)}
            >
              Usuń
            </button>
          </li>
        )
      )}
    </ul>
  );
}
