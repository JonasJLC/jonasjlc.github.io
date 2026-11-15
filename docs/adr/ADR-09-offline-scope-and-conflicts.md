# ADR-09: Offline scope and conflict rule

Status: accepted, 2026-11-15 (slice 1.8). Covers design D47.

## Context

Supermarkets have poor signal. The shopping list must be readable, tickable and addable-to without a connection, and
two phones may change the same item while one is offline. Every other tab can wait.

## Options

1. **Service worker with background sync and an offline database.** The most complete, but heavy for a two-person app, with caching rules that are easy to get wrong.
2. **Local copy plus a small queue in the page** (chosen). The list opens from the last copy on the phone; ticks, clears and added items are laid over it at once and sent when the connection returns.
3. **Online only, with an error toast.** Fails the one place the app is used with bad signal.

## Decision

Option 2.

- **Scope:** read, tick, un-tick, clear (and its undo) and add are queued. Changing a category, removing an item and generating from the plan need a connection and say so. Other tabs show what they last loaded.
- **Copy:** the last successful fetch (rows and categories) is stored in `localStorage` per household and shown first on open, then refreshed.
- **Queue:** persisted in `localStorage`, sent in order when the browser reports it is online, when the page returns to the front, and every 15 seconds while changes wait. Only the last status change per row is kept.
- **Conflict rule:** the latest change wins, per row. Every change carries the time it was made on the phone (`client_updated_at`); a status is written only over a row whose `client_updated_at` is older, so a late sync never undoes a newer tick from the other phone. Phone clocks are assumed to be within a few seconds of each other.
- **Duplicates:** an added item gets its id on the phone and is sent as an insert that ignores duplicates, so a retry after a lost response cannot create it twice.
- **Refused changes:** if the database rejects a queued change (for example the row was deleted), it is dropped so the rest still go through.
- **No storage:** if `localStorage` is unavailable, everything still works online; offline changes then last until the page reloads.

## Consequences

- Good: no new infrastructure; the whole thing is a pure overlay (`applyOps`) that is unit tested.
- Drawback: the app page itself must be loadable. Without a service worker, opening the app from cold with no signal fails; the list is only available offline once the page is already open or cached by the browser. A service worker for the shell is the follow-up if this shows up in use (spike R9).
- Drawback: `localStorage` holds the copy in plain text on the phone, which is the same exposure as the signed-in session.
