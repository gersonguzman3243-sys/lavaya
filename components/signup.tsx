"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { MapView, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fileToDataUrl } from "@/components/photos";
import type { PublicUser, Role } from "@/lib/types";

const ROLES: Array<{ id: "cliente" | "recolector" | "lavanderia"; label: string }> = [
  { id: "cliente", label: "Cliente" },
  { id: "lavanderia", label: "Lavandería" },
  { id: "recolector", label: "Recolector" },
];

export function Signup({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState<"cliente" | "recolector" | "lavanderia">("cliente");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("Av. Insurgentes Sur 100, CDMX");
  const [hours, setHours] = useState("Lun a sáb · 9:00 a 19:00");
  const [lat, setLat] = useState(19.4326);
  const [lng, setLng] = useState(-99.1332);
  const [plate, setPlate] = useState("");
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [ownRates, setOwnRates] = useState(false);
  const [normal, setNormal] = useState("12");
  const [busy, setBusy] = useState(false);

  const pin: MapPin[] = [{ id: "shop", lat, lng, kind: "shop", glyph: "🧺", label: "Tu taller" }];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ user: PublicUser }>("/api/auth/register", {
        role,
        name,
        email,
        password,
        phone,
        businessName,
        address,
        lat,
        lng,
        hours,
        plate,
        idPhoto,
        rates: ownRates
          ? {
              lavadoNormalPerKg: Number(normal),
              lavadoEnSecoPerKg: 48,
              planchadoPerKg: 18,
              recoleccionPerKm: 5,
              entregaPerKm: 5,
              itemRates: {},
            }
          : null,
      });
      toast.success(result.user.status === "pendiente" ? "Cuenta creada. Falta la aprobación." : "Cuenta lista.");
      window.location.href = home(result.user.role);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear la cuenta.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4">
      <form onSubmit={onSubmit} className="mx-auto my-6 max-w-lg space-y-4 rounded-[2rem] bg-cream p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-leaf">Registro</p>
            <h2 className="font-display text-4xl leading-none">Crear cuenta</h2>
          </div>
          <button type="button" className="text-sm font-semibold" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              className={`rounded-2xl px-2 py-3 text-sm font-bold ${role === item.id ? "bg-ink text-white" : "bg-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Field id="nombre" label={role === "lavanderia" ? "Tu nombre" : "Nombre"} value={name} onChange={setName} />
        <Field id="correo-nuevo" label="Correo" type="email" value={email} onChange={setEmail} />
        <Field id="clave-nueva" label="Contraseña" type="password" value={password} onChange={setPassword} />
        <Field id="telefono" label="Teléfono" value={phone} onChange={setPhone} />
        {role === "lavanderia" ? (
          <>
            <Field id="negocio" label="Nombre del negocio" value={businessName} onChange={setBusinessName} />
            <Field id="direccion-taller" label="Dirección" value={address} onChange={setAddress} />
            <Field id="horario" label="Horario" value={hours} onChange={setHours} />
            <div className="overflow-hidden rounded-3xl border border-border">
              <MapView
                className="h-56 w-full"
                pins={pin}
                fitKey={`${lat.toFixed(3)},${lng.toFixed(3)}`}
                onPick={(nextLat, nextLng) => {
                  setLat(nextLat);
                  setLng(nextLng);
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">Mueve el pin hasta la puerta del taller. Las cuentas nuevas quedan pendientes hasta que administración las apruebe.</p>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={ownRates} onChange={(event) => setOwnRates(event.target.checked)} />
              Usar mi propio precio de lavado normal
            </label>
            {ownRates ? (
              <Field id="precio-kg" label="Lavado normal por kg (MXN)" value={normal} onChange={setNormal} />
            ) : (
              <p className="text-sm text-muted-foreground">Si no eliges tarifa, el taller usa $12/kg y $5 por km de ida y de vuelta.</p>
            )}
          </>
        ) : null}
        {role === "recolector" ? (
          <>
            <Field id="placa" label="Placa de la moto" value={plate} onChange={setPlate} />
            <div className="space-y-1">
              <Label htmlFor="ine">INE o licencia (opcional)</Label>
              <Input
                id="ine"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void fileToDataUrl(file).then(setIdPhoto).catch(() => toast.error("No pudimos leer esa foto."));
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">Tu cuenta queda pendiente. Cuando te aprueben verás viajes cerca de ti.</p>
          </>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
    </div>
  );
}

function home(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "recolector") return "/recolector";
  if (role === "lavanderia") return "/lavanderia";
  return "/cliente";
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  );
}
