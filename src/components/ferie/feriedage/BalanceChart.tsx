import { useEffect, useMemo, useRef, useState } from 'react';
import { balanceSeries, involves } from '../lib/balance';
import { DAY, MONTHS_SHORT, fmtLong, fmtN, toTime, todayTime } from '../lib/dates';
import { PERSON_KEYS, type FerieState } from '../lib/types';
import { personColor, personName } from './helpers';

export function BalanceChart({ state }: { state: FerieState }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(340);
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

  const H = mobile ? 250 : 320;
  const L = mobile ? 30 : 40, R = 10, T = 12, rows = 34, B = 24 + rows;
  const pw = W - L - R, ph = H - T - B;
  const { st, n, ser, lo, hi, step } = geo;
  const x = (i: number) => L + (i / n) * pw;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * ph;

  const path = (b: Float64Array) => {
    let d = `M${x(0)},${y(b[0])}`;
    for (let i = 1; i < n; i++) if (Math.abs(b[i] - b[i - 1]) > 1e-6) d += `H${x(i)}V${y(b[i])}`;
    return d + `H${x(n)}`;
  };
  const pa = path(ser.a), pb = path(ser.b);
  const close = `V${y(0)}H${x(0)}Z`;

  const grid: number[] = [];
  for (let v = lo; v <= hi; v += step) grid.push(v);
  const today = todayTime();
  const todayI = (today - st) / DAY;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((px - L) / pw) * n))));
  };

  const hoverT = hover === null ? null : st + hover * DAY;
  const onTrips = hoverT === null ? [] : state.trips.filter((t) => toTime(t.from) <= hoverT && toTime(t.to) >= hoverT);
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover + 0.5), 90), W - 90);

  return (
    <section aria-label={`Saldo over ${Y}`} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Feriesaldo gennem {Y}</h2>
        <ul className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          {PERSON_KEYS.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <i className="h-[3px] w-5 rounded" style={{ background: personColor(k), opacity: k === 'b' ? 0.7 : 1 }} />
              {personName(state, k)}
            </li>
          ))}
          <li>Bjælker nederst = rejser</li>
        </ul>
      </div>
      <div ref={box} className="relative w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`Feriesaldo for ${personName(state, 'a')} og ${personName(state, 'b')} gennem ${Y}`}
          className="block h-auto w-full overflow-visible touch-pan-y select-none"
        >
          <defs>
            {PERSON_KEYS.map((k) => (
              <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={personColor(k)} stopOpacity=".26" />
                <stop offset="1" stopColor={personColor(k)} stopOpacity="0" />
              </linearGradient>
            ))}
            <clipPath id="plot"><rect x={L} y={T - 4} width={pw} height={ph + 8} /></clipPath>
          </defs>
          {lo < 0 && <rect x={L} y={y(0)} width={pw} height={y(lo) - y(0)} fill="var(--warn)" opacity=".08" />}
          {grid.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--muted-foreground)' : 'var(--border)'} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{v}</text>
            </g>
          ))}
          {MONTHS_SHORT.map((m, i) => {
            const a = Math.round((Date.UTC(Y, i, 1) - st) / DAY);
            const b = Math.round((Date.UTC(Y, i + 1, 1) - st) / DAY);
            return (
              <g key={m}>
                {i > 0 && <line x1={x(a)} x2={x(a)} y1={T} y2={T + ph} stroke="var(--border)" opacity=".6" />}
                <text x={(x(a) + x(b)) / 2} y={T + ph + 16} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
                  {mobile ? m.charAt(0).toUpperCase() : m.charAt(0).toUpperCase() + m.slice(1)}
                </text>
              </g>
            );
          })}
          {PERSON_KEYS.map((k, row) => {
            const yy = T + ph + 26 + row * 14;
            return (
              <g key={k}>
                <circle cx={L - 10} cy={yy + 4.5} r="4" fill={personColor(k)} />
                <line x1={L} x2={W - R} y1={yy + 4} y2={yy + 4} stroke="var(--border)" strokeDasharray="2 4" />
                {state.trips.filter((t) => involves(t, k)).map((t) => {
                  let a = toTime(t.from), b = toTime(t.to);
                  if (Number.isNaN(a) || Number.isNaN(b) || b < st || a > geo.en) return null;
                  a = Math.max(a, st); b = Math.min(b, geo.en);
                  const i = (a - st) / DAY, j = (b - st) / DAY + 1;
                  return <rect key={t.id} x={x(i)} y={yy} width={Math.max(3, x(j) - x(i))} height="9" rx="3" fill={personColor(k)}><title>{t.name || 'Rejse'}</title></rect>;
                })}
              </g>
            );
          })}
          <g clipPath="url(#plot)">
            <path d={pa + close} fill="url(#g-a)" />
            <path d={pb + close} fill="url(#g-b)" />
            <path d={pa} fill="none" stroke={personColor('a')} strokeWidth="3" strokeLinejoin="round" />
            <path d={pb} fill="none" stroke={personColor('b')} strokeWidth="3" strokeLinejoin="round" strokeDasharray="7 6" />
          </g>
          {todayI >= 0 && todayI <= n && (
            <g>
              <line x1={x(todayI)} x2={x(todayI)} y1={T} y2={T + ph} stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x={x(todayI) + 5} y={T + 10} fontSize="11" fontWeight="700" fill="var(--foreground)">i dag</text>
            </g>
          )}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={T} y2={T + ph + rows + 10} stroke="var(--foreground)" opacity=".35" />
              {PERSON_KEYS.map((k) => (
                <circle key={k} cx={x(hover + 0.5)} cy={y(ser[k][hover])} r="5" fill={personColor(k)} stroke="var(--card)" strokeWidth="2" />
              ))}
            </g>
          )}
          <rect
            x={L} y={T} width={pw} height={ph + rows + 10} fill="transparent"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && hoverT !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-foreground px-3 py-2 text-xs leading-snug text-background shadow-lg"
            style={{ left: tipLeft }}
          >
            <b className="block">{fmtLong(hoverT)}</b>
            {PERSON_KEYS.map((k) => (
              <span key={k} className="block">{personName(state, k)}: <b>{fmtN(ser[k][hover])}</b> dage</span>
            ))}
            {onTrips.map((t) => <span key={t.id} className="block opacity-80">✈ {t.name || 'Rejse'}</span>)}
          </div>
        )}
      </div>
    </section>
  );
}
