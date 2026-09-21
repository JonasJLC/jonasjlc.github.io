export const scenes = ['nickname', 'welcome', 'riddle', 'gift'];
export const initialState = { version: 2, scene: 'nickname', nickname: '', hint: 0 };

export function normalizeNickname(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('da-DK') : '';
}

export function findNickname(value, accepted) {
  return accepted.find((name) => normalizeNickname(name) === normalizeNickname(value)) ?? '';
}

export function otherNicknames(value, accepted) {
  return accepted.filter((name) => normalizeNickname(name) !== normalizeNickname(value));
}

export function normalizeAnswer(value) {
  return typeof value === 'string' ? value.toLocaleLowerCase('da-DK').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '') : '';
}

export function matchesAnswer(value, accepted) {
  const normalized = normalizeAnswer(value);
  return normalized.length > 0 && accepted.some((answer) => normalizeAnswer(answer) === normalized);
}

export function isValidSavedState(value, nicknames) {
  if (!value || typeof value !== 'object' || value.version !== 2 || !scenes.includes(value.scene)) return false;
  return Number.isInteger(value.hint) && value.hint >= 0 && value.hint <= 2 &&
    (value.scene === 'nickname' ? value.nickname === '' && value.hint === 0 : Boolean(findNickname(value.nickname, nicknames)));
}
