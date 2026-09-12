export const scenes = ['intro', 'packing', 'location', 'namePuzzle', 'reveal', 'details'];

export const initialState = {
  version: 1,
  scene: 'intro',
  packingIndex: 0,
  packingChoice: '',
  locationClues: 1,
  locationHint: 0,
  locationComplete: false,
  sizeHint: 0,
  sizeComplete: false,
  directionHint: 0,
  directionComplete: false,
  revealComplete: false,
};

export function normalizeAnswer(value) {
  return String(value).toLocaleLowerCase('da-DK').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function matchesAnswer(value, accepted) {
  const normalized = normalizeAnswer(value);
  return normalized.length > 0 && accepted.some((answer) => normalizeAnswer(answer) === normalized);
}

export function isValidSavedState(value, packingCount) {
  if (!value || typeof value !== 'object' || value.version !== initialState.version || !scenes.includes(value.scene)) return false;
  const integerInRange = (number, min, max) => Number.isInteger(number) && number >= min && number <= max;
  return (
    integerInRange(value.packingIndex, 0, packingCount) &&
    (value.packingChoice === '' || value.packingChoice === 'pack' || value.packingChoice === 'leave') &&
    integerInRange(value.locationClues, 1, 5) &&
    integerInRange(value.locationHint, 0, 2) &&
    integerInRange(value.sizeHint, 0, 2) &&
    integerInRange(value.directionHint, 0, 2) &&
    typeof value.locationComplete === 'boolean' &&
    typeof value.sizeComplete === 'boolean' &&
    typeof value.directionComplete === 'boolean' &&
    typeof value.revealComplete === 'boolean'
  );
}
