# Prompt 07 — Editable Spec Input

## User
hi again claude, i want the json and yaml input to be editable could you do that for me please

## Assistant
Replaced the static `<pre>` spec preview with an editable `<textarea>` bound to the `specContent` signal.

**Changes:**
- `app.html` — swapped `<pre class="spec-content">` for `<textarea>` with `[value]`, `(input)`, and `(click)="$event.stopPropagation()"` to prevent the drop-zone click handler from firing while editing
- `app.ts` — added `onSpecInput(event: Event)` which sets `specContent` and clears `result` on every keystroke
- `app.scss` — restyled `.spec-content` for a `<textarea>`: fixed `height: 280px`, `resize: vertical`, removed `border` and `outline`, kept the same monospace font and surface-variant background
