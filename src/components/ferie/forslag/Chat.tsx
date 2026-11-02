import { SendIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AREA_LABEL, askChat, saveRequest, type ChatMessage, type Draft } from '../lib/forslag';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

const MAX = 2000;

const GREETING = 'Hvad kunne du ønske dig, at Ferieplan kunne? Skriv det med dine egne ord.';

/** The chat that turns a wish into a structured request, which is saved only after the person confirms it. */
export function Chat({ householdId, onSaved }: { householdId: string | null; onSaved: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, draft, busy]);

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setText('');
    setDraft(null);
    setError(null);
    setBusy(true);
    try {
      const reply = await askChat(next);
      if (reply.type === 'question') {
        setMessages([...next, { role: 'assistant', content: reply.text }]);
      } else {
        setMessages([...next, { role: 'assistant', content: reply.message || 'Her er dit forslag.' }]);
        setDraft(reply.request);
      }
    } catch (e) {
      // Put the person's words back so nothing is lost.
      setMessages(messages);
      setText(content);
      setError(e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const save = async () => {
    if (!draft || !householdId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveRequest(householdId, draft, messages);
      setMessages([]);
      setDraft(null);
      onSaved();
    } catch {
      setError('Forslaget blev ikke gemt. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setMessages([]); setDraft(null); setError(null); setText(''); };

  return (
    <div className="flex flex-col gap-3 rounded-panel bg-panel p-4 sm:p-5">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Samtale om dit forslag"
        className="flex max-h-[26rem] min-h-40 flex-col gap-2.5 overflow-y-auto"
      >
        <Bubble who="assistant">{GREETING}</Bubble>
        {messages.map((m, i) => <Bubble key={i} who={m.role}>{m.content}</Bubble>)}
        {busy && <p role="status" className="px-1 text-sm text-muted-foreground">Tænker …</p>}
      </div>

      {draft && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">{AREA_LABEL[draft.area]}</p>
            <h3 className="text-[15px] leading-6 font-semibold">{draft.title}</h3>
          </div>
          <p className="text-sm leading-6">{draft.summary}</p>
          {draft.why && <p className="text-sm leading-6 text-muted-foreground"><b className="font-medium text-foreground">Hvorfor: </b>{draft.why}</p>}
          {draft.acceptance.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-5 text-muted-foreground">
              {draft.acceptance.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || !householdId}>Gem forslag</Button>
            <Button variant="ghost" onClick={() => inputRef.current?.focus()}>Ret noget</Button>
          </div>
        </div>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <label htmlFor="forslag-input" className="sr-only">Dit ønske eller svar</label>
        <Textarea
          id="forslag-input"
          ref={inputRef}
          value={text}
          maxLength={MAX}
          rows={3}
          placeholder={messages.length ? 'Skriv dit svar …' : 'F.eks. “Jeg vil gerne kunne se, hvor meget vi har brugt pr. rejse”'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
          disabled={busy}
        />
        {error && <p role="alert" className="text-sm text-warn">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {messages.length > 0
            ? <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>Start forfra</Button>
            : <span />}
          <Button type="submit" disabled={busy || !text.trim()}>
            <SendIcon aria-hidden />Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ who, children }: { who: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-6 whitespace-pre-wrap',
        who === 'user' ? 'self-end bg-data-tint text-foreground' : 'self-start bg-card text-foreground',
      )}
    >
      <span className="sr-only">{who === 'user' ? 'Dig: ' : 'Chatten: '}</span>
      {children}
    </p>
  );
}
