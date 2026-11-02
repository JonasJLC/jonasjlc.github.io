import { BedDoubleIcon, MapPinIcon, PlaneIcon, TicketIcon, TrainFrontIcon, UtensilsCrossedIcon } from 'lucide-react';
import type { PlanItem, PlanType } from '../lib/types';

export function TypeIcon({ type, flight, className }: { type: PlanType; flight?: boolean; className?: string }) {
  const p = { className, 'aria-hidden': true } as const;
  switch (type) {
    case 'transport': return flight ? <PlaneIcon {...p} /> : <TrainFrontIcon {...p} />;
    case 'oplevelse': return <TicketIcon {...p} />;
    case 'mad': return <UtensilsCrossedIcon {...p} />;
    case 'overnatning': return <BedDoubleIcon {...p} />;
    default: return <MapPinIcon {...p} />;
  }
}

/** The plan's own icon: a plane when a transport plan carries flight details. */
export const ItemIcon = ({ item, className }: { item: Pick<PlanItem, 'type' | 'flight'>; className?: string }) => (
  <TypeIcon type={item.type} flight={!!item.flight} className={className} />
);

/** Category colour classes per kind of plan. Written out in full so Tailwind sees them. */
const TONES: Record<PlanType, { chip: string; ink: string; dot: string; tint: string }> = {
  transport: { chip: 'bg-cat-transport-tint text-cat-transport-ink', ink: 'text-cat-transport-ink', dot: 'bg-cat-transport', tint: 'bg-cat-transport-tint' },
  oplevelse: { chip: 'bg-cat-oplevelse-tint text-cat-oplevelse-ink', ink: 'text-cat-oplevelse-ink', dot: 'bg-cat-oplevelse', tint: 'bg-cat-oplevelse-tint' },
  mad: { chip: 'bg-cat-mad-tint text-cat-mad-ink', ink: 'text-cat-mad-ink', dot: 'bg-cat-mad', tint: 'bg-cat-mad-tint' },
  overnatning: { chip: 'bg-cat-overnatning-tint text-cat-overnatning-ink', ink: 'text-cat-overnatning-ink', dot: 'bg-cat-overnatning', tint: 'bg-cat-overnatning-tint' },
  andet: { chip: 'bg-cat-andet-tint text-cat-andet-ink', ink: 'text-cat-andet-ink', dot: 'bg-cat-andet', tint: 'bg-cat-andet-tint' },
};
export const typeTone = (t: PlanType) => TONES[t] ?? TONES.andet;
