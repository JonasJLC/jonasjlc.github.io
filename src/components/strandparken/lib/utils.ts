import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Local copy of the shadcn helper, so /ferie's copy stays untouched. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
