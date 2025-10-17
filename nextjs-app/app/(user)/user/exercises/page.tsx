"use client";

import { useEffect, useState } from "react";
import ExerciseList from "./components/ExercisesList";
import ExerciseForm from "./components/ExercisesForm";

export default function ExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExercises = async () => {
    setLoading(true);
    const res = await fetch("/api/exercises");
    const data = await res.json();
    setExercises(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  return (
    <section>
      <h1>Moje ćwiczenia</h1>
      <ExerciseForm onExerciseAdded={fetchExercises} />
      <ExerciseList
        exercises={exercises}
        loading={loading}
        onExerciseUpdated={fetchExercises}
        onExerciseDeleted={fetchExercises}
      />
    </section>
  );
}
