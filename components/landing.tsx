"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { Signup } from "@/components/signup";
import { Bike, Shirt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicUser } from "@/lib/types";

const ACCOUNTS = [
  { role: "Cliente", email: "ana@lavaya.mx", name: "Ana García", hint: "Pide y sigue la moto" },
  { role: "Recolector", email: "luis@lavaya.mx", name: "Luis Hernández", hint: "Acepta viajes en moto" },
  { role: "Lavandería", email: "rosa@lavaya.mx", name: "Rosa Méndez", hint: "Pesa, cobra y avisa" },
];

export function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("lavaya123");
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [signup, setSignup] = useState(false);

  async function enter(nextEmail: string, nextPassword = "lavaya123") {
    setBusy(nextEmail);
    try {
      const result = await api<{ user: PublicUser }>("/api/auth/login", {
        email: nextEmail,
        password: nextPassword,
      });
      const path =
        result.user.role === "admin"
          ? "/admin"
          : result.user.role === "recolector"
            ? "/recolector"
            : result.user.role === "lavanderia"
              ? "/lavanderia"
              : "/cliente";
      window.location.href = path;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos entrar.");
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await enter(email, password);
  }

  async function resetDemo() {
    setBusy("reset");
    try {
      await api("/api/demo/reset", {});
      toast.success("Volvimos a los datos de demostración.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos restablecer.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-ink">CDMX · MXN</span>
      </header>
      <section className="mt-8 grid items-end gap-8 md:mt-14 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-leaf">Recolección en moto</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] text-ink md:text-7xl">
            Tu ropa, recogida en moto.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink/80">
            Pide la recolección, sigue al motociclista y acepta el precio cuando la lavandería pesa lo que de verdad llegó.
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Dices qué ropa hay"],
              ["2", "La moto la lleva al taller"],
              ["3", "Aceptas kilos y total"],
            ].map(([step, label]) => (
              <li key={step} className="rounded-3xl bg-white/80 px-4 py-3">
                <span className="font-display text-2xl text-mango">{step}</span>
                <span className="mt-1 block text-sm font-semibold">{label}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[2rem] bg-ink p-5 text-white shadow-xl">
          <p className="text-sm text-white/70">Mercado Pago en pruebas, u efectivo al recibir. Sin llaves, el cobro queda en modo demo.</p>
          <p className="mt-2 font-display text-3xl leading-tight">Lavado desde $12 por kilo, más la ida y la vuelta por kilómetro.</p>
          <p className="mt-3 text-sm text-white/75">Recolección y entrega se ven aparte en el desglose. Cada una a $5 por km, y la lavandería puede cambiarlo.</p>
        </div>
      </section>
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        <RoleCard
          icon={<Shirt className="h-6 w-6" />}
          title="Soy cliente"
          body="Arma el pedido, mira el mapa y acepta el total cuando llegue la ropa."
          account="Ana García"
          busy={busy === "ana@lavaya.mx"}
          onClick={() => void enter("ana@lavaya.mx")}
        />
        <RoleCard
          icon={<Bike className="h-6 w-6" />}
          title="Soy recolector"
          body="Toma un viaje, chatea con el cliente y marca recogida y entrega."
          account="Luis Hernández"
          tone="mango"
          busy={busy === "luis@lavaya.mx"}
          onClick={() => void enter("luis@lavaya.mx")}
        />
        <RoleCard
          icon={<Sparkles className="h-6 w-6" />}
          title="Soy la lavandería"
          body="Registra peso, fotos y tarifas. Avisa cuando la ropa esté lista."
          account="Rosa Méndez"
          busy={busy === "rosa@lavaya.mx"}
          onClick={() => void enter("rosa@lavaya.mx")}
        />
      </section>
      <section className="mt-8 rounded-[2rem] bg-white/80 p-5">
        <h2 className="font-display text-3xl">Cuentas de demostración</h2>
        <p className="mt-1 text-sm text-muted-foreground">Las tres usan la contraseña lavaya123. Entras directo con los botones de arriba.</p>
        <div className="mt-4 divide-y divide-border">
          {ACCOUNTS.map((account) => (
            <div key={account.email} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold">{account.role} · {account.name}</p>
                <p className="text-sm text-muted-foreground">{account.email}</p>
              </div>
              <p className="text-sm">{account.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setShowForm((value) => !value)}>
            Entrar con correo
          </Button>
          <Button type="button" onClick={() => setSignup(true)}>
            Crear cuenta
          </Button>
          <Button type="button" variant="ghost" disabled={busy === "reset"} onClick={() => void resetDemo()}>
            Restablecer demo
          </Button>
        </div>
        {showForm ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label htmlFor="correo">Correo</Label>
              <Input id="correo" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ana@lavaya.mx" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="clave">Contraseña</Label>
              <Input id="clave" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <Button type="submit" className="sm:col-span-2" disabled={Boolean(busy)}>
              Entrar
            </Button>
          </form>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Administración de la demo: admin@lavaya.mx · lavaya123. Ahí se aprueban lavanderías y recolectores nuevos.
        </p>
      </section>
      {signup ? <Signup onClose={() => setSignup(false)} /> : null}
    </main>
  );
}

function RoleCard({
  icon,
  title,
  body,
  account,
  onClick,
  busy,
  tone = "paper",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  account: string;
  onClick: () => void;
  busy: boolean;
  tone?: "paper" | "mango";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-[1.7rem] p-4 text-left shadow-sm transition hover:-translate-y-0.5 disabled:opacity-70 ${tone === "mango" ? "bg-mango text-ink" : "bg-white text-ink"}`}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone === "mango" ? "bg-white/70" : "bg-secondary text-leaf"}`}>
        {icon}
      </span>
      <span className="mt-4 block font-display text-3xl leading-none">{title}</span>
      <span className="mt-2 block text-sm leading-relaxed opacity-80">{body}</span>
      <span className="mt-4 block text-sm font-bold">{busy ? "Entrando…" : `Entrar como ${account}`}</span>
    </button>
  );
}
