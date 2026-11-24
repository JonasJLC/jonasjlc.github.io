import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { areaLabel, askChat, saveRequest, type ChatMessage, type Draft } from '../lib/forslag';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { Textarea } from '../ui/textarea';

const MAX = 2000;

const GREETING = 'Hvad kunne du ønske dig, at Strandparken kunne? Skriv det med dine egne ord.';

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
    <div className="flex flex-col gap-sp-gap">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Samtale om dit forslag"
        className="flex max-h-104 min-h-40 flex-col gap-2.5 overflow-y-auto"
      >
        <Bubble who="assistant">{GREETING}</Bubble>
        {messages.map((m, i) => <Bubble key={i} who={m.role}>{m.content}</Bubble>)}
        {busy && <p role="status" className="sp-small px-1 text-sp-muted">Tænker …</p>}
      </div>

      {draft && (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="sp-small text-sp-muted">{areaLabel('strandparken', draft.area)}</p>
            <h2 className="sp-title-group">{draft.title}</h2>
          </div>
          <p className="sp-body">{draft.summary}</p>
          {draft.why && <p className="sp-body text-sp-muted"><b className="sp-body-strong text-sp-ink">Hvorfor: </b>{draft.why}</p>}
          {draft.acceptance.length > 0 && (
            <ul className="sp-body list-disc space-y-1 pl-5 text-sp-muted">
              {draft.acceptance.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button inCard onClick={() => void save()} disabled={busy || !householdId}>Gem forslag</Button>
            <Button variant="quiet" onClick={() => inputRef.current?.focus()}>Ret noget</Button>
          </div>
        </Card>
      )}

      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label htmlFor="forslag-input" className="sr-only">Dit ønske eller svar</label>
        <Textarea
          id="forslag-input"
          ref={inputRef}
          value={text}
          maxLength={MAX}
          rows={3}
          placeholder={messages.length ? 'Skriv dit svar …' : 'F.eks. “Jeg vil gerne kunne se, hvem der har købt ind sidst”'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
          disabled={busy}
        />
        {error && <p role="alert" className="sp-small text-sp-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {messages.length > 0
            ? <Button variant="quiet" onClick={reset} disabled={busy}>Start forfra</Button>
            : <span />}
          <Button type="submit" inCard disabled={busy || !text.trim()}>
            <Icon icon={Send} size={18} />Send
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
        'sp-body max-w-[88%] rounded-sp-card px-3.5 py-2 whitespace-pre-wrap text-sp-ink',
        who === 'user' ? 'self-end bg-sp-primary-tint' : 'self-start bg-sp-surface',
      )}
    >
      <span className="sr-only">{who === 'user' ? 'Dig: ' : 'Chatten: '}</span>
      {children}
    </p>
  );
}
