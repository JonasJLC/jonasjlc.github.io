import { Activity, CalendarHeart, Footprints, Moon, type LucideIcon } from 'lucide-react';
import type { Tile, TileKey } from '../lib/health/view';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';

const icons: Record<TileKey, LucideIcon> = { sleep: Moon, activity: Activity, steps: Footprints, cycle: CalendarHeart };

/** One number for today: icon, label, then the value, or a quiet "Ingen data i nat" when there is none. */
export function MetricTile({ tile }: { tile: Tile }) {
  return (
    <Card className="flex min-h-28 flex-col justify-between gap-3">
      <span className="flex items-center gap-2 text-sp-muted">
        <Icon icon={icons[tile.key]} size={20} />
        <span className="sp-small">{tile.label}</span>
      </span>
      {tile.value === null ? (
        <span className="sp-small text-sp-muted">{tile.empty}</span>
      ) : (
        <span className="sp-stat-sm text-sp-ink">{tile.value}</span>
      )}
    </Card>
  );
}

/** Four grey placeholders while the numbers load. */
export function TileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Henter tal" className="grid grid-cols-2 gap-sp-gap">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="flex min-h-28 flex-col justify-between gap-3">
          <span className="h-3 w-1/2 rounded-sp-pill bg-sp-track" />
          <span className="h-6 w-2/3 rounded-sp-pill bg-sp-track" />
        </Card>
      ))}
    </div>
  );
}
