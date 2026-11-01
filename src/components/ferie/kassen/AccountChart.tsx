import { useMemo, useState } from 'react';
import { DAY, MONTHS_SHORT, fmtShort, toTime } from '../lib/dates';
import { analyze, cap, eventLabel, idxOf, kr, krAxis, moneyModel } from '../lib/kasse';
import { useWidth } from '../lib/use-width';
import type { FerieState } from '../lib/types';
import type { Action } from '../lib/use-ferie';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
  const H = mobile ? 250 : 310;
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
  const L = mobile ? 50 : 62, R = 12, T = 14, B = 28;
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

  const sliderMax = Math.max(5000, Math.ceil((Math.max(D, req, scen ?? 0) * 2) / 500) * 500);
  const val = scen ?? D;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Kontoen over tid</CardTitle>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5"><i className="h-[3px] w-5 rounded bg-cash" />{hasSteps(state) ? 'Med jeres trappeplan' : `Med ${kr(D)} om måneden`}</li>
          {sc && <li className="inline-flex items-center gap-1.5"><i className="h-[3px] w-5 rounded bg-holiday" />Med {kr(scen ?? 0)} om måneden</li>}
          <li className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full border-2 border-cash" />Betaling fra kontoen</li>
        </ul>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div ref={ref} className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Rejsekassens saldo over tid" className="block h-auto w-full touch-pan-y select-none overflow-visible">
            <defs>
              <linearGradient id="g-cash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--cash)" stopOpacity=".25" /><stop offset="1" stopColor="var(--cash)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="cash-clip"><rect x={L} y={T - 6} width={pw} height={ph + 12} /></clipPath>
            </defs>
            {lo < Math.max(0, buf) && <rect x={L} y={yv(Math.max(0, buf))} width={pw} height={yv(lo) - yv(Math.max(0, buf))} fill="var(--warn)" opacity=".07" />}
            {grid.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={yv(v)} y2={yv(v)} stroke={Math.abs(v) < 1e-6 ? 'var(--muted-foreground)' : 'var(--border)'} />
                <text x={L - 6} y={yv(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{krAxis(v)}</text>
              </g>
            ))}
            {buf > 0 && (
              <g>
                <line x1={L} x2={W - R} y1={yv(buf)} y2={yv(buf)} stroke="var(--warn)" strokeDasharray="4 4" opacity=".7" />
                <text x={W - R} y={yv(buf) - 5} textAnchor="end" fontSize="11" fill="var(--warn)">Mindst {kr(buf)}</text>
              </g>
            )}
            {months.map((t, k) => {
              const i = (t - st) / DAY;
              const M = new Date(t).getUTCMonth();
              return (
                <g key={t}>
                  <line x1={x(i)} x2={x(i)} y1={T} y2={T + ph} stroke="var(--border)" opacity={M === 0 ? 1 : 0.5} />
                  {(k % every === 0 || M === 0) && (
                    <text x={x(i) + 4} y={T + ph + 16} fontSize="11" fontWeight={M === 0 ? 700 : 400} fill={M === 0 ? 'var(--foreground)' : 'var(--muted-foreground)'}>
                      {M === 0 ? new Date(t).getUTCFullYear() : mobile ? MONTHS_SHORT[M].charAt(0).toUpperCase() : cap(MONTHS_SHORT[M])}
                    </text>
                  )}
                </g>
              );
            })}
            <g clipPath="url(#cash-clip)">
              <path d={pa + `V${yv(Math.max(lo, 0))}H${x(0)}Z`} fill="url(#g-cash)" />
              <path d={pa} fill="none" stroke="var(--cash)" strokeWidth="3" strokeLinejoin="round" />
              {sc && <path d={path(sc.bal)} fill="none" stroke="var(--holiday)" strokeWidth="2.5" strokeDasharray="7 6" strokeLinejoin="round" />}
            </g>
            {lookI !== null && (
              <g>
                <line x1={x(lookI)} x2={x(lookI)} y1={T} y2={T + ph} stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x={x(lookI) + 5} y={T + 10} fontSize="11" fontWeight="700" fill="var(--foreground)">{fmtShort(lk)}</text>
              </g>
            )}
            {cur.ev.filter((e) => e.amt < 0).map((e) => {
              const i = idxOf(cur, e.t);
              return <circle key={e.it.id} cx={x(i)} cy={yv(cur.bal[i])} r="3.5" fill="var(--card)" stroke="var(--cash)" strokeWidth="2"><title>{eventLabel(state, e)}: {kr(-e.amt)}</title></circle>;
            })}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={T} y2={T + ph} stroke="var(--foreground)" opacity=".35" />
                <circle cx={x(hover + 0.5)} cy={yv(cur.bal[hover])} r="5" fill="var(--cash)" stroke="var(--card)" strokeWidth="2" />
              </g>
            )}
            <rect x={L} y={T} width={pw} height={ph} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
          {hover !== null && hoverT !== null && (
            <div className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl bg-foreground px-3 py-2 text-xs leading-snug text-background shadow-lg" style={{ left: tipLeft }}>
              <b className="block">{fmtShort(hoverT, true)}</b>
              Kontoen: <b>{kr(cur.bal[hover])}</b>
              {sc && <span className="block">Med {kr(scen ?? 0)}/md.: <b>{kr(sc.bal[hover])}</b></span>}
              {todays.map((t) => <span key={t} className="block opacity-80">{t}</span>)}
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-muted p-4">
          <div className="flex items-baseline justify-between gap-3">
            <b className="text-sm">Hvad hvis I satte et andet beløb ind?</b>
            <output className="font-display text-lg font-bold tabular-nums">{kr(val)} / md.</output>
          </div>
          <Slider
            className="my-4"
            aria-label="Månedligt indskud, scenarie"
            min={0}
            max={sliderMax}
            step={50}
            value={[val]}
            onValueChange={([v]) => setScen(v)}
          />
          {sc ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-muted-foreground">
                Laveste saldo bliver {kr(sc.min)} d. {fmtShort(sc.minT, true)}
                {lookI !== null ? `, og d. ${fmtShort(lk, true)} står der ${kr(sc.bal[idxOf(sc, lk)])}` : '.'}
              </p>
              <Button size="sm" onClick={() => onUse(scen ?? 0)}>Brug {kr(scen ?? 0)}</Button>
              <Button size="sm" variant="outline" onClick={() => setScen(null)}>Nulstil</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Træk i skyderen for at se, hvad et andet beløb betyder for kontoen.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
