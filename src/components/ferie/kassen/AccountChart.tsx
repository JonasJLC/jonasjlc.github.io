import { useMemo, useState } from 'react';
import { DAY, MONTHS_SHORT, fmtShort, toTime } from '../lib/dates';
import { analyze, cap, eventLabel, idxOf, kr, krAxis, moneyModel } from '../lib/kasse';
import { useWidth } from '../lib/use-width';
import type { FerieState } from '../lib/types';
import type { Action } from '../lib/use-ferie';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Money } from '../page';
import { Slider } from '../ui/slider';
import { hasSteps } from '../lib/kasse';

export function AccountChart({
  state, today, scen, setScen, onUse,
}: {
  state: FerieState; today: number; dispatch?: React.Dispatch<Action>;
  scen: number | null; setScen: (v: number | null) => void; onUse: (total: number) => void;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const cur = useMemo(() => moneyModel(state, today), [state, today]);
  const req = useMemo(() => analyze(state, today).cReq, [state, today]);
  const D = cur.D;
  const useScen = scen !== null && (hasSteps(state) || Math.abs(scen - D) > 0.5);
  const sc = useMemo(() => (useScen ? moneyModel(state, today, scen) : null), [state, today, scen, useScen]);

  const mobile = W < 560;
  const H = mobile ? 220 : 280;
  const { st, n } = cur;
  const buf = +state.kasse.buffer || 0;
  let lo = Math.min(0, buf);
  let hi = 1000;
  for (const v of cur.bal) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (sc) for (const v of sc.bal) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const raw = (hi - lo) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const stp = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) ?? mag * 10;
  lo = Math.floor(lo / stp) * stp;
  hi = Math.ceil((hi * 1.04) / stp) * stp;
  const L = mobile ? 46 : 56, R = 8, T = 22, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const x = (i: number) => L + (i / n) * pw;
  const yv = (v: number) => T + ((hi - v) / (hi - lo)) * ph;
  const path = (b: Float64Array) => {
    let d = `M${x(0)},${yv(b[0])}`;
    for (let i = 1; i < n; i++) if (Math.abs(b[i] - b[i - 1]) > 0.01) d += `H${x(i)}V${yv(b[i])}`;
    return d + `H${x(n)}`;
  };
  const pa = path(cur.bal);
  const grid: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += stp) grid.push(v);

  const d0 = new Date(st);
  let y = d0.getUTCFullYear();
  let mo = d0.getUTCMonth() + 1;
  if (mo > 11) { mo = 0; y++; }
  const months: number[] = [];
  for (let i = 0; i < 40; i++) {
    const t = Date.UTC(y, mo, 1);
    if (t > cur.en) break;
    months.push(t);
    mo++;
    if (mo > 11) { mo = 0; y++; }
  }
  const every = months.length > 18 || mobile ? 2 : 1;
  const lk = toTime(state.kasse.look);
  const lookI = !Number.isNaN(lk) && lk >= st && lk <= cur.en ? idxOf(cur, lk) + 0.5 : null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((px - L) / pw) * n))));
  };
  const hoverT = hover === null ? null : st + hover * DAY;
  const todays = hoverT === null ? [] : cur.ev.filter((e) => e.t === hoverT).map((e) => `${eventLabel(state, e)}: ${e.amt < 0 ? '−' : '+'}${kr(Math.abs(e.amt))}`);
  if (hover !== null && cur.depMark[hover] && cur.depAmt[hover] > 0) todays.push(`Fast indskud: +${kr(cur.depAmt[hover])}`);
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover + 0.5), 100), W - 100);

  // The range must not depend on the dragged value, or every pull to the end would widen it again.
  const sliderMax = Math.max(10000, Math.ceil((Math.max(D, req) * 2) / 1000) * 1000);
  const val = Math.min(scen ?? D, sliderMax);

  const dip = sc ? sc.min : cur.min;
  return (
    <Card variant="sheet" className="gap-3">
      <CardHeader className="sm:grid-cols-[1fr_auto]">
        <CardTitle>Kontoen over tid</CardTitle>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end">
          <li className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-data" />{hasSteps(state) ? 'Med jeres trappeplan' : `Med ${kr(D)} om måneden`}</li>
          {sc && <li className="inline-flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-foreground" />Med {kr(scen ?? 0)} om måneden</li>}
          <li className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full border-[1.5px] border-foreground bg-card" />Betaling fra kontoen</li>
        </ul>
      </CardHeader>
      <div ref={ref} className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Rejsekassens saldo over tid. Laveste saldo ${kr(cur.min)} d. ${fmtShort(cur.minT, true)}.`} className="block h-auto w-full touch-pan-y select-none overflow-visible">
          <defs>
            <clipPath id="cash-clip"><rect x={L} y={T - 6} width={pw} height={ph + 12} /></clipPath>
          </defs>
          {dip < buf - 0.5 && <rect x={L} y={yv(buf)} width={pw} height={Math.max(0, yv(lo) - yv(buf))} fill="var(--warn)" opacity=".06" />}
          {grid.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yv(v)} y2={yv(v)} stroke={Math.abs(v) < 1e-6 ? 'var(--muted-foreground)' : 'var(--grid)'} />
              <text x={L - 8} y={yv(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{krAxis(v)}</text>
            </g>
          ))}
          {buf > 0 && (
            <g>
              <line x1={L} x2={W - R} y1={yv(buf)} y2={yv(buf)} stroke={dip < buf - 0.5 ? 'var(--warn)' : 'var(--muted-foreground)'} strokeDasharray="4 4" />
              <text x={W - R} y={yv(buf) - 5} textAnchor="end" fontSize="11" fill={dip < buf - 0.5 ? 'var(--warn)' : 'var(--muted-foreground)'}>Mindst {kr(buf)}</text>
            </g>
          )}
          {months.map((t, k) => {
            const i = (t - st) / DAY;
            const M = new Date(t).getUTCMonth();
            if (every > 1 ? M % 3 !== 0 : !(k % every === 0 || M === 0)) return null;
            return (
              <text key={t} x={x(i) + 3} y={T + ph + 17} fontSize="11" fontWeight={M === 0 ? 600 : 400} fill={M === 0 ? 'var(--foreground)' : 'var(--muted-foreground)'}>
                {M === 0 ? new Date(t).getUTCFullYear() : mobile ? MONTHS_SHORT[M].charAt(0).toUpperCase() : cap(MONTHS_SHORT[M])}
              </text>
            );
          })}
          <g clipPath="url(#cash-clip)">
            <path d={pa + `V${yv(Math.max(lo, 0))}H${x(0)}Z`} fill="var(--data)" opacity=".1" />
            <path d={pa} fill="none" stroke="var(--data)" strokeWidth="2" strokeLinejoin="round" />
            {sc && <path d={path(sc.bal)} fill="none" stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="5 4" strokeLinejoin="round" />}
          </g>
          {lookI !== null && (
            <g>
              <line x1={x(lookI)} x2={x(lookI)} y1={T - 6} y2={T + ph} stroke="var(--foreground)" strokeDasharray="2 3" />
              <text x={x(lookI)} y={T - 10} textAnchor={x(lookI) > W - 80 ? 'end' : 'middle'} fontSize="11" fontWeight="600" fill="var(--foreground)">{fmtShort(lk)}</text>
            </g>
          )}
          {cur.ev.filter((e) => e.amt < 0).map((e) => {
            const i = idxOf(cur, e.t);
            return <circle key={e.it.id} cx={x(i)} cy={yv(cur.bal[i])} r="3" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.5"><title>{eventLabel(state, e)}: {kr(-e.amt)}</title></circle>;
          })}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={T} y2={T + ph} stroke="var(--foreground)" opacity=".3" />
              <circle cx={x(hover + 0.5)} cy={yv(cur.bal[hover])} r="4" fill="var(--data)" stroke="var(--card)" strokeWidth="2" />
            </g>
          )}
          <rect x={L} y={T} width={pw} height={ph} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover !== null && hoverT !== null && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-xs leading-5 shadow-[0_8px_24px_rgba(0,0,0,.12)]" style={{ left: tipLeft }}>
            <span className="block font-medium">{fmtShort(hoverT, true)}</span>
            <span className="block">Kontoen <span className="tabular-nums">{kr(cur.bal[hover])}</span></span>
            {sc && <span className="block text-muted-foreground">Med {kr(scen ?? 0)}/md. <span className="text-foreground tabular-nums">{kr(sc.bal[hover])}</span></span>}
            {todays.map((t) => <span key={t} className="block text-muted-foreground">{t}</span>)}
          </div>
        )}
      </div>
      <div className="mt-1 border-t border-rule pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">Hvad hvis I satte et andet beløb ind?</p>
          <output className="shrink-0 text-lg"><Money value={val} /><span className="text-sm text-muted-foreground"> / md.</span></output>
        </div>
        <Slider
          className="my-4"
          aria-label="Månedligt indskud, scenarie"
          min={0}
          max={sliderMax}
          step={500}
          value={[val]}
          onValueChange={([v]) => setScen(v)}
        />
        {sc ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-muted-foreground">
              Laveste saldo bliver <span className={sc.min < buf - 0.5 ? 'font-medium text-warn' : 'text-foreground'}>{kr(sc.min)}</span> d. {fmtShort(sc.minT, true)}
              {lookI !== null ? <>, og d. {fmtShort(lk, true)} står der <span className="text-foreground">{kr(sc.bal[idxOf(sc, lk)])}</span></> : '.'}
            </p>
            <Button size="sm" variant="outline" onClick={() => setScen(null)}>Nulstil</Button>
            <Button size="sm" variant="outline" onClick={() => onUse(scen ?? 0)}>Brug {kr(scen ?? 0)}</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Træk i skyderen for at se, hvad et andet beløb betyder for kontoen.</p>
        )}
      </div>
    </Card>
  );
}
