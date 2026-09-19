"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
        Te mandamos un link a <strong>{email}</strong>. Abrilo desde este mismo celular.
      </p>
    );
  }

  return (
    <form onSubmit={send} className="flex w-full flex-col gap-3">
      <label htmlFor="email" className="text-sm font-semibold">
        Tu email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-card px-4 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {status === "sending" ? "Enviando…" : "Enviarme el link"}
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-muted-foreground">
          No se pudo enviar el link. Revisá el email y probá de nuevo.
        </p>
      )}
    </form>
  );
}
