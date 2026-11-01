import { useEffect, useMemo, useRef, useState } from 'react';
import { balanceSeries, involves } from '../lib/balance';
import { DAY, MONTHS_SHORT, fmtLong, fmtN, fmtShort, toTime, todayTime } from '../lib/dates';
import { PERSON_KEYS, type FerieState } from '../lib/types';
import { fmtHours } from '../lib/units';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { personColor, personName } from './helpers';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The year as one strip: each person's balance as a step line, and under it a lane per person
 * with their trips as labelled bars, on the same days. Today is the one line in the data hue.
 */
export function BalanceChart({ state }: { state: FerieState }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(300, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const Y = state.settings.year;
  const mobile = W < 560;
  const geo = useMemo(() => {
    const st = Date.UTC(Y, 0, 1);
    const en = Date.UTC(Y, 11, 31);
    const n = Math.round((en - st) / DAY) + 1;
    const ser = { a: balanceSeries(state, 'a', st, en), b: balanceSeries(state, 'b', st, en) };
    let lo = 0;
    let hi = 5;
    for (const k of PERSON_KEYS) for (const v of ser[k]) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const step = hi - lo > 45 ? 10 : 5;
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil((hi + 0.8) / step) * step;
    return { st, en, n, ser, lo, hi, step };
  }, [state, Y]);

  const { st, en, n, ser, lo, hi, step } = geo;
  const plotH = mobile ? 150 : 190;
  const lane = 28, barH = 20;
  const L = mobile ? 34 : 72, R = 4, T = 22;
  const axisY = T + plotH + 18;
  const lanesY = axisY + 14;
  const H = lanesY + lane * 2 + 2;
  const pw = W - L - R;
  const x = (i: number) => L + (i / n) * pw;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * plotH;

  const path = (b: Float64Array) => {
    let d = `M${x(0)},${y(b[0])}`;
    for (let i = 1; i < n; i++) if (Math.abs(b[i] - b[i - 1]) > 1e-6) d += `H${x(i)}V${y(b[i])}`;
    return d + `H${x(n)}`;
  };

  const grid: number[] = [];
  for (let v = lo; v <= hi; v += step) grid.push(v);
  const today = todayTime();
  const todayI = (today - st) / DAY;
  const showToday = todayI >= 0 && todayI <= n;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((px - L) / pw) * n))));
  };

  const hoverT = hover === null ? null : st + hover * DAY;
  const onTrips = hoverT === null ? [] : state.trips.filter((t) => toTime(t.from) <= hoverT && toTime(t.to) >= hoverT);
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover + 0.5), 100), W - 100);
  const label = PERSON_KEYS.map((k) => `${personName(state, k)} slutter året med ${fmtN(ser[k][n - 1])} dage`).join(', ');

  return (
    <Card variant="sheet" className="gap-3">
      <CardHeader className="sm:grid-cols-[1fr_auto]">
        <CardTitle>Saldo og rejser gennem {Y}</CardTitle>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end">
          {PERSON_KEYS.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <i className={k === 'a' ? 'h-[4.5px] w-4 rounded' : 'h-0.5 w-4 rounded'} style={{ background: personColor(k) }} />{personName(state, k)}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5"><i className="h-3 w-px bg-data" />I dag</li>
        </ul>
      </CardHeader>
      <div ref={box} className="relative w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`Feriesaldo og rejser gennem ${Y}. ${label}.`}
          className="block h-auto w-full touch-pan-y select-none overflow-visible"
        >
          <defs>
            <clipPath id="plot"><rect x={L} y={T - 4} width={pw} height={plotH + 8} /></clipPath>
          </defs>
          {lo < 0 && <rect x={L} y={y(0)} width={pw} height={y(lo) - y(0)} fill="var(--warn)" opacity=".06" />}
          {grid.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--muted-foreground)' : 'var(--grid)'} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{v}</text>
            </g>
          ))}
          {MONTHS_SHORT.map((m, i) => {
            const a = Math.round((Date.UTC(Y, i, 1) - st) / DAY);
            const b = Math.round((Date.UTC(Y, i + 1, 1) - st) / DAY);
            return (
              <g key={m}>
                {i > 0 && <line x1={x(a)} x2={x(a)} y1={lanesY} y2={H} stroke="var(--grid)" />}
                <text x={(x(a) + x(b)) / 2} y={axisY} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
                  {mobile ? m.charAt(0).toUpperCase() : cap(m)}
                </text>
              </g>
            );
          })}
          <g clipPath="url(#plot)">
            {PERSON_KEYS.map((k) => (
              <path key={k} d={path(ser[k])} fill="none" stroke={personColor(k)} strokeWidth={k === 'a' ? 4.5 : 1.75} strokeLinejoin="round" />
            ))}
          </g>
          {PERSON_KEYS.map((k, row) => {
            const ly = lanesY + row * lane;
            return (
              <g key={k}>
                <rect x={L} y={ly} width={pw} height={lane - 4} rx="4" fill="var(--panel)" />
                {mobile ? (
                  <text x={L - 8} y={ly + 16} textAnchor="end" fontSize="11" fontWeight="600" fill={personColor(k)}>{personName(state, k).charAt(0)}</text>
                ) : (
                  <text x={L - 8} y={ly + 16} textAnchor="end" fontSize="12" fill="var(--foreground)">{personName(state, k)}</text>
                )}
                {state.trips.filter((t) => involves(t, k)).map((t) => {
                  let a = toTime(t.from), b = toTime(t.to);
                  if (Number.isNaN(a) || Number.isNaN(b) || b < st || a > en) return null;
                  a = Math.max(a, st); b = Math.min(b, en);
                  const i = (a - st) / DAY, j = (b - st) / DAY + 1;
                  const bw = Math.max(4, x(j) - x(i));
                  const name = t.name || 'Rejse';
                  const fits = name.length * 6.2 + 14 < bw;
                  const after = !fits && x(j) + name.length * 6.2 + 8 < W - R;
                  return (
                    <g key={t.id}>
                      <rect x={x(i)} y={ly + 2} width={bw} height={barH} rx="4" fill={k === 'a' ? 'var(--person-a-tint)' : 'var(--person-b-tint)'} />
                      <rect x={x(i)} y={ly + 2} width={Math.min(3, bw)} height={barH} rx="1.5" fill={personColor(k)} />
                      {!mobile && (fits || after) && (
                        <text x={fits ? x(i) + 9 : x(j) + 6} y={ly + 16} fontSize="11" fill="var(--foreground)">{name}</text>
                      )}
                      <title>{name}, {fmtShort(toTime(t.from))}–{fmtShort(toTime(t.to))}</title>
                    </g>
                  );
                })}
              </g>
            );
          })}
          {showToday && (
            <g>
              <line x1={x(todayI)} x2={x(todayI)} y1={T - 6} y2={H} stroke="var(--data)" />
              <text x={x(todayI)} y={T - 10} textAnchor={x(todayI) < L + 30 ? 'start' : 'middle'} fontSize="11" fontWeight="600" fill="var(--data)">I dag</text>
            </g>
          )}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={T} y2={H} stroke="var(--foreground)" opacity=".3" />
              {PERSON_KEYS.map((k) => (
                <circle key={k} cx={x(hover + 0.5)} cy={y(ser[k][hover])} r="4" fill={personColor(k)} stroke="var(--card)" strokeWidth="2" />
              ))}
            </g>
          )}
          <rect
            x={L} y={T} width={pw} height={H - T} fill="transparent"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && hoverT !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-xs leading-5 shadow-[0_8px_24px_rgba(0,0,0,.12)]"
            style={{ left: tipLeft }}
          >
            <span className="block font-medium first-letter:uppercase">{fmtLong(hoverT)}</span>
            {PERSON_KEYS.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <i className="size-1.5 rounded-full" style={{ background: personColor(k) }} />
                {personName(state, k)} <span className="tabular-nums">{fmtN(ser[k][hover])} dage</span>
                <span className="text-muted-foreground tabular-nums">{fmtHours(ser[k][hover], state.settings)}</span>
              </span>
            ))}
            {onTrips.map((t) => <span key={t.id} className="block text-muted-foreground">{t.name || 'Rejse'}</span>)}
          </div>
        )}
      </div>
    </Card>
  );
}
