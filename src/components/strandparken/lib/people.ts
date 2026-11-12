/** The two people of the household and their stable colours (UI spec §3.1). Class names are literal so Tailwind can see them. */
export type Person = 'jonas' | 'camilla';

export const people: Record<Person, { name: string; initial: string; photo: string; fill: string; tint: string; ink: string }> = {
  jonas: { name: 'Jonas', initial: 'J', photo: '/ferie/avatars/jonas.jpg', fill: 'bg-sp-jonas', tint: 'bg-sp-jonas-tint', ink: 'text-sp-jonas-ink' },
  camilla: { name: 'Camilla', initial: 'C', photo: '/ferie/avatars/camilla.jpg', fill: 'bg-sp-camilla', tint: 'bg-sp-camilla-tint', ink: 'text-sp-camilla-ink' },
};
