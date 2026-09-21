import { gift } from '../content/gift';
import { initialState, isValidSavedState, findNickname, otherNicknames, matchesAnswer } from './gave-logic.mjs';

type State = typeof initialState;
const app = document.querySelector<HTMLElement>('#gave-app');
const storageKey = 'gave-reveal-v2';
let state = loadState();

function loadState(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (isValidSavedState(saved, gift.nicknames)) return saved;
  } catch { /* Progress also works in memory. */ }
  return { ...initialState };
}

function escape(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] ?? character);
}

function button(label: string, action: string, quiet = false) {
  return `<button class="gave-button${quiet ? ' gave-button--quiet' : ''}" type="button" data-action="${action}">${label}</button>`;
}

function panel(kicker: string, title: string, copy: string, body: string) {
  return `<section class="gave-shell"><div class="gave-panel"><p class="gave-kicker">${kicker}</p><h1 id="scene-title" tabindex="-1">${escape(title)}</h1><p class="gave-copy">${escape(copy)}</p>${body}</div></section>`;
}

function form(label: string, submit: string) {
  return `<form class="gave-form"><label for="answer">${label}</label><input id="answer" name="answer" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" required aria-describedby="answer-feedback" /><p id="answer-feedback" class="gave-feedback" role="status"></p><button class="gave-button" type="submit">${submit}</button></form>`;
}

function render(focus = true) {
  if (!app) return;
  if (state.scene === 'nickname') {
    app.innerHTML = panel('Kun til dig', gift.gate.title, gift.gate.copy, form('Dit kælenavn', 'Luk mig ind'));
  } else if (state.scene === 'welcome') {
    app.innerHTML = panel('Det er jo dig ♥', `Velkommen, ${state.nickname}`, gift.gate.alternatives,
      `<ul class="gave-nicknames">${otherNicknames(state.nickname, gift.nicknames).map((name: string) => `<li>${escape(name)}</li>`).join('')}</ul>${button('Åbn din gave', 'open')}`);
  } else if (state.scene === 'riddle') {
    app.innerHTML = panel('En lille gåde', gift.riddle.title, gift.riddle.copy,
      `${form('Hvad hedder stedet?', 'Svar')}<div class="gave-hints"><div id="hints" aria-live="polite">${hintMarkup()}</div>${button('Et lille hint', 'hint', true)}</div>`);
    updateHintButton();
  } else {
    app.innerHTML = `<article class="gave-gift"><header class="gave-hero"><img src="${gift.images[0].src}" alt="${gift.images[0].alt}" width="1600" height="1067" /><div class="gave-hero__text"><p class="gave-kicker">Vi skal til</p><h1 id="scene-title" tabindex="-1">${gift.destination}</h1><p>Kerteminde · Kun os to</p></div></header><section class="gave-summary" aria-labelledby="gift-title"><p class="gave-kicker">Din gave</p><h2 id="gift-title">${gift.title}</h2><p class="gave-date">${gift.date}</p><p class="gave-copy">${gift.message}</p><h3>31. oktober</h3><ol class="gave-itinerary">${gift.itinerary.map((item) => `<li><span class="gave-time">${item.time}</span><div><h4>${item.title}</h4><p>${item.description}</p></div></li>`).join('')}</ol><img class="gave-photo" src="${gift.images[1].src}" alt="${gift.images[1].alt}" width="1200" height="800" loading="lazy" /><p class="gave-closing">Jeg glæder mig til at dele det med dig ♥</p>${button('Start forfra', 'restart', true)}</section></article>`;
    app.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => { img.hidden = true; }));
  }
  if (focus) app.querySelector<HTMLElement>('#scene-title')?.focus();
}

function hintMarkup() {
  return gift.riddle.hints.slice(0, state.hint).map((hint) => `<p>${escape(hint)}</p>`).join('');
}

function updateHintButton() {
  const hintButton = app?.querySelector<HTMLButtonElement>('[data-action="hint"]');
  if (hintButton) {
    hintButton.disabled = state.hint >= gift.riddle.hints.length;
    hintButton.textContent = hintButton.disabled ? 'Alle hints er vist' : state.hint ? 'Et hint mere' : 'Et lille hint';
  }
}

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Storage is optional. */ }
}

function setScene(scene: string) {
  state = { ...state, scene };
  save();
  render();
  window.scrollTo(0, 0);
}

app?.addEventListener('click', (event) => {
  const action = (event.target as Element).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
  if (action === 'open' && state.scene === 'welcome') setScene('riddle');
  if (action === 'hint' && state.scene === 'riddle') {
    state.hint = Math.min(gift.riddle.hints.length, state.hint + 1);
    save();
    const hints = app.querySelector('#hints');
    if (hints) hints.innerHTML = hintMarkup();
    updateHintButton();
  }
  if (action === 'restart') {
    state = { ...initialState };
    setScene('nickname');
  }
});

app?.addEventListener('submit', (event) => {
  event.preventDefault();
  const answer = new FormData(event.target as HTMLFormElement).get('answer');
  if (state.scene === 'nickname') {
    const nickname = findNickname(answer, gift.nicknames);
    if (nickname) { state.nickname = nickname; setScene('welcome'); return; }
  } else if (state.scene === 'riddle' && matchesAnswer(answer, gift.riddle.answers)) {
    setScene('gift');
    return;
  }
  const feedback = app.querySelector('#answer-feedback');
  if (feedback) feedback.textContent = state.scene === 'nickname' ? gift.gate.error : gift.riddle.error;
  const input = app.querySelector<HTMLInputElement>('#answer');
  input?.setAttribute('aria-invalid', 'true');
  input?.focus();
});

app?.addEventListener('input', () => app.querySelector('#answer')?.removeAttribute('aria-invalid'));
render(false);
