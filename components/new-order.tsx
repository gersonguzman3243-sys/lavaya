"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { MapView, type MapPin as Pin } from "@/components/map";
import { fileToDataUrl, samplePhoto } from "@/components/photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Counter, GarmentLine, PriceCard, garmentsFrom } from "@/components/widgets";
import { GARMENTS, PLACES, estimateKg, serviceLabel } from "@/lib/catalog";
import { mexicoLocalToIso, mxn } from "@/lib/format";
import type { BaseService, PriceBreakdown, Rates } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QuoteResponse {
  price: PriceBreakdown;
  couponError: string | null;
  estimatedKg: number;
}

export function NewOrder({
  rates,
  initialCoupon,
  onCancel,
  onCreated,
}: {
  rates: Rates;
  initialCoupon?: string | null;
  onCancel: () => void;
  onCreated: (orderId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState<string>(PLACES[0].address);
  const [reference, setReference] = useState("");
  const [lat, setLat] = useState<number>(PLACES[0].lat);
  const [lng, setLng] = useState<number>(PLACES[0].lng);
  const [whenMode, setWhenMode] = useState<"ahora" | "programar">("ahora");
  const [when, setWhen] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [baseService, setBaseService] = useState<BaseService>("lavado_normal");
  const [planchado, setPlanchado] = useState(false);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState(initialCoupon ?? "");
  const [applied, setApplied] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<PriceBreakdown | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (step !== 3 || !initialCoupon || applied) return;
    setCouponInput(initialCoupon);
    setApplied(initialCoupon);
    setCouponMessage("Cupón de la promoción listo. Lo verás en el desglose.");
  }, [step, initialCoupon, applied]);

  const garments = useMemo(() => garmentsFrom(counts), [counts]);
  const kg = garments.length ? estimateKg(garments) : 0;

  function draft(couponCode: string | null) {
    return {
      address,
      reference,
      lat,
      lng,
      notes,
      customerPhoto: photo,
      garments,
      baseService,
      planchado,
      scheduledFor: whenMode === "programar" && when ? mexicoLocalToIso(when) : null,
      couponCode,
    };
  }

  useEffect(() => {
    if (step !== 3) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setQuoting(true);
        try {
          const result = await api<QuoteResponse>("/api/quote", draft(applied));
          setQuote(result.price);
          setQuoteError(null);
        } catch (error) {
          setQuote(null);
          setQuoteError(error instanceof Error ? error.message : "No pudimos calcular el precio.");
        } finally {
          setQuoting(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
    // El cupón aplicado y la ropa disparan la cotización; draft se arma con el estado actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lat, lng, address, baseService, planchado, applied, counts, whenMode, when]);

  function next() {
    if (step === 1) {
      if (address.trim().length < 6) {
        toast.error("Escribe la dirección donde pasamos por la ropa.");
        return;
      }
      if (whenMode === "programar" && !when) {
        toast.error("Elige fecha y hora, o pide la recolección ahora.");
        return;
      }
    }
    if (step === 2 && garments.length === 0) {
      toast.error("Cuéntanos al menos una prenda.");
      return;
    }
    setStep((value) => Math.min(3, value + 1));
  }

  async function applyCoupon() {
    try {
      const result = await api<QuoteResponse>("/api/quote", draft(couponInput));
      if (result.couponError) {
        setApplied(null);
        setCouponMessage(result.couponError);
        setQuote(result.price);
        return;
      }
      setApplied(couponInput.trim().toUpperCase());
      setCouponMessage("Cupón aplicado. Ya se ve en el desglose.");
      setQuote(result.price);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos validar el cupón.");
    }
  }

  async function submit() {
    setSaving(true);
    try {
      const result = await api<{ order: { id: string } }>("/api/orders", draft(applied));
      toast.success("Listo. Ya buscamos un recolector.");
      onCreated(result.order.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear el pedido.");
    } finally {
      setSaving(false);
    }
  }

  const pin: Pin[] = [{ id: "drop", lat, lng, kind: "drop", glyph: "📍", label: "Aquí pasamos" }];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <button type="button" onClick={step === 1 ? onCancel : () => setStep((value) => value - 1)} className="inline-flex items-center gap-1 text-sm font-semibold text-leaf">
          <ChevronLeft className="h-4 w-4" />
          {step === 1 ? "Inicio" : "Atrás"}
        </button>
        <div className="flex gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {["Dónde", "Ropa", "Precio"].map((label, index) => (
            <span key={label} className={cn("rounded-full px-3 py-1", step === index + 1 ? "bg-ink text-white" : "bg-white")}>
              {index + 1}. {label}
            </span>
          ))}
        </div>

        {step === 1 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-4xl leading-none">¿Dónde pasamos?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Mueve el pin o elige una colonia. La dirección escrita es la que ve el recolector.
              </p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-border">
              <MapView className="h-60 w-full" pins={pin} fitKey={`${lat.toFixed(3)},${lng.toFixed(3)}`} onPick={(nextLat, nextLng) => { setLat(nextLat); setLng(nextLng); }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {PLACES.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    setAddress(place.address);
                    setLat(place.lat);
                    setLng(place.lng);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-semibold",
                    address === place.address ? "bg-leaf text-white" : "bg-white text-ink",
                  )}
                >
                  {place.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Calle, número, colonia" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referencia">Referencia</Label>
              <Input id="referencia" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Timbre, color de la fachada, piso" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast.error("Este aparato no comparte ubicación.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setLat(position.coords.latitude);
                    setLng(position.coords.longitude);
                    toast.success("Movimos el pin a tu ubicación.");
                  },
                  () => toast.error("No pudimos usar tu ubicación. Elige una colonia."),
                  { enableHighAccuracy: true, timeout: 8000 },
                );
              }}
            >
              <MapPin className="h-4 w-4" />
              Usar mi ubicación
            </Button>
            <div>
              <p className="mb-2 text-sm font-semibold">¿Para cuándo?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWhenMode("ahora")} className={cn("rounded-2xl border px-3 py-4 text-left", whenMode === "ahora" ? "border-leaf bg-secondary" : "border-border bg-white")}>
                  <span className="block font-bold">Ahora mismo</span>
                  <span className="text-xs text-muted-foreground">Sale el primer recolector libre</span>
                </button>
                <button type="button" onClick={() => setWhenMode("programar")} className={cn("rounded-2xl border px-3 py-4 text-left", whenMode === "programar" ? "border-leaf bg-secondary" : "border-border bg-white")}>
                  <span className="block font-bold">Programar</span>
                  <span className="text-xs text-muted-foreground">Elige día y hora</span>
                </button>
              </div>
              {whenMode === "programar" ? (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="cuando">Fecha y hora</Label>
                  <Input id="cuando" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
                  <p className="text-xs text-muted-foreground">La hora es de la Ciudad de México. Mínimo 15 minutos de anticipación.</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-4xl leading-none">¿Qué mandamos?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Un aproximado basta. El peso estimado es {kg ? `${kg.toFixed(1)} kg` : "—"}. Cobramos los kilos que lleguen al taller.
              </p>
            </div>
            <div className="grid gap-2">
              {GARMENTS.map((item) => (
                <Counter
                  key={item.id}
                  label={item.label}
                  value={counts[item.id] ?? 0}
                  onChange={(value) => setCounts((current) => ({ ...current, [item.id]: value }))}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Servicio</p>
              {([
                ["lavado_normal", `Lavado normal · ${mxn(rates.lavadoNormalPerKg)} / kg`, "El servicio de todos los días."],
                ["lavado_en_seco", `Lavado en seco · ${mxn(rates.lavadoEnSecoPerKg)} / kg`, "Sustituye al lavado normal. Tarifa de ejemplo."],
              ] as const).map(([id, title, help]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBaseService(id)}
                  className={cn("block w-full rounded-2xl border px-4 py-3 text-left", baseService === id ? "border-leaf bg-secondary" : "border-border bg-white")}
                >
                  <span className="block font-bold">{title}</span>
                  <span className="text-xs text-muted-foreground">{help}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPlanchado((value) => !value)}
                className={cn("block w-full rounded-2xl border px-4 py-3 text-left", planchado ? "border-mango bg-cream" : "border-border bg-white")}
              >
                <span className="block font-bold">Planchado · {mxn(rates.planchadoPerKg)} / kg</span>
                <span className="text-xs text-muted-foreground">
                  {planchado ? "Se suma al servicio principal." : "Opcional. Tarifa de ejemplo, se suma por kilo."}
                </span>
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas">Notas para el taller</Label>
              <Textarea id="notas" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sin suavizante, mancha en la camisa blanca..." />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Foto de la bolsa, si quieres</p>
              <div className="flex gap-2">
                <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold">
                  Elegir foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      try {
                        setPhoto(await fileToDataUrl(file));
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "No pudimos usar esa foto.");
                      }
                    }}
                  />
                </label>
                <Button type="button" variant="outline" onClick={() => setPhoto(samplePhoto("Bolsa del cliente", address))}>
                  Foto de ejemplo
                </Button>
              </div>
              {photo ? <img src={photo} alt="Vista previa de la bolsa" className="h-36 w-full rounded-2xl object-cover" /> : null}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-4xl leading-none">Tu estimado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {serviceLabel(baseService)}
                {planchado ? " + planchado" : ""}. {kg.toFixed(1)} kg estimados. El total final cambia con el peso real.
              </p>
            </div>
            <div className="rounded-3xl bg-white p-4 text-sm">
              <p className="font-semibold">{address}</p>
              <p className="text-muted-foreground">{whenMode === "programar" && when ? "Programada" : "Para ahora"}</p>
              <div className="mt-2">
                <GarmentLine items={garments} />
              </div>
            </div>
            <div className="flex gap-2">
              <Input value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} placeholder="Cupón" aria-label="Cupón" />
              <Button type="button" variant="outline" onClick={() => void applyCoupon()}>
                Aplicar
              </Button>
            </div>
            {couponMessage ? <p className="text-sm text-leaf">{couponMessage}</p> : null}
            {quoting ? <p className="text-sm text-muted-foreground">Calculando distancia y precio…</p> : null}
            {quoteError ? <p className="text-sm text-red-700">{quoteError}</p> : null}
            {quote ? <PriceCard price={quote} title="Desglose" caption="Pago simulado. En esta demostración no se hace ningún cargo." /> : null}
          </section>
        ) : null}
      </div>
      <div className="sticky bottom-0 border-t border-border bg-white/95 p-4 backdrop-blur">
        {step < 3 ? (
          <Button type="button" size="lg" className="w-full" onClick={next}>
            Continuar
          </Button>
        ) : (
          <Button type="button" size="lg" className="w-full" disabled={saving || quoting || !quote} onClick={() => void submit()}>
            {saving ? "Enviando…" : "Pedir recolección"}
          </Button>
        )}
      </div>
    </div>
  );
}
