import { gift } from '../content/gift';
import { initialState, isValidSavedState, matchesAnswer } from './gave-logic.mjs';

type Scene = typeof initialState.scene;
type State = typeof initialState;

const app = document.querySelector<HTMLElement>('#gave-app');
const live = document.querySelector<HTMLElement>('#gave-live');
const storageKey = 'gave-reveal-v1';
let timers: number[] = [];
let locked = false;
let state = loadState();

function loadState(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (isValidSavedState(saved, gift.packing.length)) {
      return saved.scene === 'reveal' && !saved.revealComplete ? { ...saved, scene: 'reveal' } : saved;
    }
  } catch {
    // Local storage is optional for this private invitation.
  }
  return { ...initialState, unlockedClueIds: ['location-1'] };
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Continue in memory when storage is unavailable.
  }
}

function escape(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] ?? character);
}

function panel(kicker: string, title: string, copy: string, body = '') {
  return `<section class="gave-shell"><div class="gave-panel" aria-labelledby="scene-title"><p class="gave-kicker">${kicker}</p><h1 class="gave-title" id="scene-title" tabindex="-1">${title}</h1><p class="gave-copy">${copy}</p>${body}</div></section>`;
}

function actions(...buttons: Array<[string, string, string?]>) {
  return `<div class="gave-actions">${buttons.map(([label, action, kind = '']) => `<button class="gave-button ${kind}" type="button" data-action="${action}">${label}</button>`).join('')}</div>`;
}

function setScene(scene: Scene, announcement = '') {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
  locked = false;
  state = { ...state, scene };
  save();
  render();
  live && (live.textContent = announcement);
}

function renderIntro() {
  const greeting = gift.recipientName ? `Kære ${escape(gift.recipientName)}` : 'Kære dig';
  app!.innerHTML = panel(gift.opening.classification, greeting, 'Der venter en lille plan. Kun for os to.', `<div class="gave-dossier"><p><strong>Formål</strong><span>${escape(gift.opening.purpose)}</span></p><p><strong>Varighed</strong><span>${escape(gift.opening.duration)}</span></p></div>${actions(['Begynd', 'begin'])}`);
}

function renderPacking() {
  if (state.packingIndex >= gift.packing.length) return setScene('location', 'Første spor er klar.');
  const item = gift.packing[state.packingIndex];
  const choice = state.packingChoice;
  const feedback = choice ? `<p class="gave-feedback">${escape(choice === 'pack' ? item.pack : item.leave)}</p>${actions(['Næste ting', 'next-packing'])}` : actions(['Pak', 'pack'], ['Lad blive hjemme', 'leave', 'gave-button--quiet']);
  app!.innerHTML = panel(`Pakkerunde ${state.packingIndex + 1} / ${gift.packing.length}`, 'Tag denne med?', item.item, feedback);
}

function renderLocation() {
  const clues = gift.location.clues.slice(0, state.locationClues).map((clue) => `<li>${escape(clue)}</li>`).join('');
  const feedback = state.locationComplete ? `<p class="gave-feedback">Korrekt. ${escape(gift.location.answers[0])} er første del af invitationen.</p>${actions(['Fortsæt', 'to-name'])}` : '';
  const hint = state.locationHint ? `<p class="gave-feedback">${escape(gift.location.hints[state.locationHint - 1])}</p>` : '';
  const reveal = state.locationHint === 2 ? actions(['Vis mig svaret', 'location-answer', 'gave-button--quiet']) : actions(['Et lille hint', 'location-hint', 'gave-button--quiet']);
  app!.innerHTML = panel('Lokation', 'Hvor skal vi hen?', 'Sporene dukker op ét ad gangen.', `<ol class="gave-clues">${clues}</ol>${feedback || `<form class="gave-form" data-form="location"><div class="gave-answer"><label for="location-answer">Dit bud</label><input id="location-answer" name="answer" autocomplete="off" required /></div>${actions(['Svar', 'submit'])}</form>${hint}<div class="gave-actions">${state.locationClues < gift.location.clues.length ? `<button class="gave-button gave-button--quiet" type="button" data-action="more-clue">Vis næste spor</button>` : ''}${reveal}</div>`}`);
}

function puzzle(title: string, copy: string, key: 'size' | 'direction') {
  const complete = state[`${key}Complete`];
  const hintLevel = state[`${key}Hint`];
  const answers = key === 'size' ? gift.namePuzzle.sizeAnswers : gift.namePuzzle.directionAnswers;
  const hint = key === 'size' ? gift.namePuzzle.sizeHint : gift.namePuzzle.directionHint;
  const explanation = key === 'size' ? 'Stor kan også være GREAT. Gem det ord.' : 'Nord hedder NORTH på engelsk.';
  const compass = key === 'direction' ? '<div class="gave-compass" aria-label="Et kompas med nord markeret"></div>' : '';
  const next = key === 'size' ? actions(['Næste lille gåde', 'direction']) : actions(['Saml sporene', 'to-reveal']);
  const controls = complete ? `<p class="gave-feedback">${explanation}</p>${next}` : `<form class="gave-form" data-form="${key}"><div class="gave-answer"><label for="${key}-answer">Dit svar</label><input id="${key}-answer" name="answer" autocomplete="off" required /></div>${actions(['Svar', 'submit'])}</form>${hintLevel ? `<p class="gave-feedback">${hint}</p>` : ''}${actions([hintLevel ? 'Vis mig svaret' : 'Et lille hint', `${key}-hint`, 'gave-button--quiet'])}`;
  app!.innerHTML = panel('Navnet', title, copy, `${compass}${controls}`);
}

function renderName() {
  if (!state.sizeComplete) return puzzle('Modsat lille?', 'Skriv svaret. Det må gerne være på dansk eller engelsk.', 'size');
  if (state.nameStage === 'size') {
    app!.innerHTML = panel('Navnet', 'Et spor er fundet.', 'Stor kan også være GREAT. Gem det ord.', actions(['Næste lille gåde', 'direction']));
    return;
  }
  puzzle('Hvilken retning er markeret?', 'Se på kompasset og skriv retningen.', 'direction');
}

function renderReveal() {
  const lines = state.revealComplete ? ['Destination identificeret.', 'Pak badetøj.', 'Du og jeg skal af sted.', 'GREAT NORTHERN', 'Kerteminde'] : ['Destination identificeret.'];
  app!.innerHTML = `<section class="gave-reveal"><div class="gave-reveal__content"><p class="gave-kicker">INVITATIONEN ER ÅBNET</p><h1 class="gave-title is-visible" id="scene-title" tabindex="-1">${lines[0]}</h1>${state.revealComplete ? `${actions(['Fortæl mig alt', 'details'])}` : actions(['Fortsæt', 'reveal-next'])}</div></section>`;
}

function renderDetails() {
  const labels: Record<string, string> = { date: 'Dato', checkIn: 'Check-in', checkOut: 'Check-ud', hotelStay: 'Ophold', dinner: 'Middag', spaAccess: 'Spa', treatments: 'Behandlinger', breakfast: 'Morgenmad', address: 'Adresse' };
  const rows = Object.entries(gift.details).filter(([key, value]) => key !== 'message' && value).map(([key, value]) => `<div><dt>${labels[key]}</dt><dd>${escape(value)}</dd></div>`).join('');
  const message = gift.details.message ? `<p class="gave-feedback">${escape(gift.details.message)}</p>` : '';
  app!.innerHTML = panel('Praktisk', 'Det hele venter på os.', 'Resten af detaljerne kommer, når tiden er inde.', `${rows ? `<dl class="gave-details">${rows}</dl>` : ''}${message}<div class="gave-restart">${actions(['Start forfra', 'restart', 'gave-button--quiet'])}</div>`);
}

function render() {
  if (!app) return;
  ({ intro: renderIntro, packing: renderPacking, location: renderLocation, namePuzzle: renderName, reveal: renderReveal, details: renderDetails }[state.scene])();
  requestAnimationFrame(() => app.querySelector<HTMLElement>('#scene-title')?.focus());
}

function choosePacking(choice: 'pack' | 'leave') {
  if (locked || state.packingChoice) return;
  locked = true;
  state = { ...state, packingChoice: choice };
  save();
  render();
}

function completePuzzle(key: 'size' | 'direction') {
  state = { ...state, [`${key}Complete`]: true };
  save();
  render();
}

app?.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'begin') setScene('packing');
  if (action === 'pack' || action === 'leave') choosePacking(action);
  if (action === 'next-packing') { locked = false; state = { ...state, packingIndex: state.packingIndex + 1, packingChoice: '' }; save(); render(); }
  if (action === 'more-clue') { state = { ...state, locationClues: Math.min(5, state.locationClues + 1), unlockedClueIds: Array.from({ length: Math.min(5, state.locationClues + 1) }, (_, index) => `location-${index + 1}`) }; save(); render(); }
  if (action === 'location-hint') { state = { ...state, locationHint: Math.min(2, state.locationHint + 1) }; save(); render(); }
  if (action === 'location-answer') { state = { ...state, locationComplete: true, locationClues: 5 }; save(); render(); }
  if (action === 'to-name') setScene('namePuzzle');
  if (action === 'size-hint' || action === 'direction-hint') { const key = action.startsWith('size') ? 'sizeHint' : 'directionHint'; state = { ...state, [key]: Math.min(2, state[key] + 1) }; if (state[key] === 2) completePuzzle(key === 'sizeHint' ? 'size' : 'direction'); else { save(); render(); } }
  if (action === 'direction') { state = { ...state, nameStage: 'direction' }; save(); render(); }
  if (action === 'to-reveal') setScene('reveal');
  if (action === 'reveal-next') { state = { ...state, revealComplete: true }; save(); render(); }
  if (action === 'details') setScene('details');
  if (action === 'restart') { try { localStorage.removeItem(storageKey); } catch {} state = { ...initialState, unlockedClueIds: ['location-1'] }; setScene('intro'); }
});

app?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const answer = new FormData(form).get('answer');
  if (form.dataset.form === 'location') { if (matchesAnswer(answer, gift.location.answers)) { state = { ...state, locationComplete: true, locationClues: 5 }; save(); render(); } else if (live) live.textContent = 'Ikke helt endnu. Prøv et spor eller et hint.'; }
  if (form.dataset.form === 'size' && matchesAnswer(answer, gift.namePuzzle.sizeAnswers)) completePuzzle('size');
  if (form.dataset.form === 'direction' && matchesAnswer(answer, gift.namePuzzle.directionAnswers)) completePuzzle('direction');
});

render();
