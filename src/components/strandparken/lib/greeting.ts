const timeZone = 'Europe/Copenhagen'; // D53: all dates are computed in Europe/Copenhagen

const hourFormat = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone });
const dateFormat = new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone });

/** Godmorgen 04-10, Goddag 11-17, Godaften 18-03, by the hour in Copenhagen. */
export function greetingFor(date: Date): string {
  const hour = Number(hourFormat.format(date));
  if (hour >= 4 && hour < 11) return 'Godmorgen';
  if (hour >= 11 && hour < 18) return 'Goddag';
  return 'Godaften';
}

/** "Torsdag 12. november". */
export function dateLine(date: Date): string {
  const text = dateFormat.format(date);
  return text.charAt(0).toLocaleUpperCase('da') + text.slice(1);
}
