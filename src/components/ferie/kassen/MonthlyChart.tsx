import { DAY, MONTHS_SHORT } from '../lib/dates';
import { cap, kr, krShort, monthOf, type MoneyModel, type Segment } from '../lib/kasse';
import { useWidth } from '../lib/use-width';
import type { FerieState } from '../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Month { t: number; tEnd: number; exp: number; dep: number; rec: number | null }

export function MonthlyChart({ state, m, rec }: { state: FerieState; m: MoneyModel; rec: Segment[] | null }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const outs = m.ev.filter((e) => e.amt < 0);
  if (!outs.length) return null;

  const mobile = W < 560;
  const H = mobile ? 210 : 240;
  const d0 = new Date(m.st);
  let y = d0.getUTCFullYear();
  let mo = d0.getUTCMonth();
  const lastOut = outs[outs.length - 1].t;
  const months: Month[] = [];
  for (let k = 0; k < (mobile ? 12 : 18); k++) {
    const t = Date.UTC(y, mo, 1);
    if (t > lastOut && months.length >= 6) break;
    months.push({ t, tEnd: Date.UTC(y, mo + 1, 1) - DAY, exp: 0, dep: 0, rec: null });
    mo++;
    if (mo > 11) { mo = 0; y++; }
  }
  const find = (t: number) => months.find((x) => t >= x.t && t <= x.tEnd);
  for (const e of outs) { const M = find(e.t); if (M) M.exp += -e.amt; }
  let k = 0;
  for (let i = 0; i < m.n; i++) {
    if (!m.depMark[i]) continue;
    k++;
    const M = find(m.st + i * DAY);
    if (!M) continue;
    M.dep += m.depAmt[i];
    if (rec && rec.length) {
      const sg = rec.find((x) => k > x.k0 && k <= x.k1) ?? rec[rec.length - 1];
      M.rec = (M.rec ?? 0) + sg.rate;
    }
  }
  let maxUp = 1;
  let maxDn = 1;
  for (const M of months) { maxUp = Math.max(maxUp, M.dep, M.rec ?? 0); maxDn = Math.max(maxDn, M.exp); }
  const L = 6, R = 6, T = 20, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const sc = ph / (maxUp + maxDn);
  const zeroY = T + maxUp * sc;
  const cw = pw / months.length;
  const bw = Math.min(34, cw * 0.58);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Måned for måned</CardTitle>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-cash" />{rec ? 'Anbefalet indskud' : 'Jeres indskud'}</li>
          {rec && <li className="inline-flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-foreground" />Det, I sætter ind nu</li>}
          <li className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-warn/80" />Udgifter fra kontoen</li>
        </ul>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="w-full">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Indskud og udgifter måned for måned" className="block h-auto w-full">
            <line x1={L} x2={W - R} y1={zeroY} y2={zeroY} stroke="var(--muted-foreground)" />
            {months.map((M, i) => {
              const cx = L + cw * i + cw / 2;
              const up = M.rec ?? M.dep;
              const mn = new Date(M.t).getUTCMonth();
              const lab = mn === 0 ? String(new Date(M.t).getUTCFullYear()) : mobile ? MONTHS_SHORT[mn].charAt(0).toUpperCase() : cap(MONTHS_SHORT[mn]);
              return (
                <g key={M.t}>
                  {up > 0 && (
                    <>
                      <rect x={cx - bw / 2} y={zeroY - up * sc} width={bw} height={up * sc} rx="4" fill="var(--cash)">
                        <title>{cap(monthOf(state, M.t))}: {M.rec !== null ? 'anbefalet indskud' : 'indskud'} {kr(up)}</title>
                      </rect>
                      <text x={cx} y={zeroY - up * sc - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground)">{krShort(up)}</text>
                    </>
                  )}
                  {M.rec !== null && M.dep > 0 && Math.abs(M.rec - M.dep) > 0.5 && (
                    <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={zeroY - M.dep * sc} y2={zeroY - M.dep * sc} stroke="var(--foreground)" strokeWidth="2" strokeDasharray="3 2">
                      <title>Nuværende indskud {kr(M.dep)}</title>
                    </line>
                  )}
                  {M.exp > 0 && (
                    <>
                      <rect x={cx - bw / 2} y={zeroY} width={bw} height={M.exp * sc} rx="4" fill="var(--warn)" opacity=".8">
                        <title>{cap(monthOf(state, M.t))}: udgifter {kr(M.exp)}</title>
                      </rect>
                      <text x={cx} y={zeroY + M.exp * sc + 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--warn)">{krShort(M.exp)}</text>
                    </>
                  )}
                  <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fontWeight={mn === 0 ? 700 : 400} fill={mn === 0 ? 'var(--foreground)' : 'var(--muted-foreground)'}>{lab}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
