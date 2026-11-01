import { BedDoubleIcon, MapPinIcon, TicketIcon, TrainFrontIcon, UtensilsCrossedIcon } from 'lucide-react';
import type { PlanType } from '../lib/types';

export function TypeIcon({ type, className }: { type: PlanType; className?: string }) {
  const p = { className, 'aria-hidden': true } as const;
  switch (type) {
    case 'transport': return <TrainFrontIcon {...p} />;
    case 'oplevelse': return <TicketIcon {...p} />;
    case 'mad': return <UtensilsCrossedIcon {...p} />;
    case 'overnatning': return <BedDoubleIcon {...p} />;
    default: return <MapPinIcon {...p} />;
  }
}
