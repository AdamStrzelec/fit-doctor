"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";

export default function AIPage() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setInput,
  } = useChat({
    api: "/api/ai/chat",
    initialMessages: [
      { id: "sys-1", role: "assistant", content: "Cześć! Jak mogę pomóc?" },
    ],
  });

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">AI Chat</h1>

      <div className="border rounded-lg p-3 h-[60vh] overflow-y-auto bg-white/50 dark:bg-black/20">
        {messages.map((m) => (
          <div key={m.id} className="mb-3">
            <div className="text-xs text-gray-500 mb-1">
              {m.role === "user" ? "Ty" : "AI"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Zadaj pytanie..."
          className="flex-1 border rounded-md px-3 py-2"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50"
        >
          Wyślij
        </button>
        {isLoading && (
          <button
            type="button"
            onClick={() => stop()}
            className="px-3 py-2 rounded-md border"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={() => setInput("")}
          className="px-3 py-2 rounded-md border"
        >
          Wyczyść
        </button>
      </form>
      <p className="text-xs text-gray-500">Ścieżka: /ai</p>
    </div>
  );
}
