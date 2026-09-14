# SDD lifecycle diagrams

Five diagrams of what the spec-driven development (SDD) workflow prescribes:

1. `journey` — the numbered path from a blank project (or an existing codebase) through steering, decomposition, one spec's phases, retrospective and close-out, then around to the next spec. Two layouts: `lr` (left to right) and `tb` (top to bottom).
2. `fsm` — the hierarchical state machine: the product, one spec inside it, one document phase inside that.
3. `review-loop` — the adversarial review loop, zoomed.
4. `task-loop` — the implementation loop, completion gate and PR gate, zoomed.
5. `steering` — how the steering documents become the decomposition and the spec queue.

## Files

| Path | What it is |
| --- | --- |
| `model.mjs` | The content: stages, steps, states, transitions, labels, colours. Edit this. |
| `render.mjs` | The layout and SVG output. Edit only to change how things are drawn. |
| `svg/<diagram>-<verbosity>-<theme>.svg` | Generated. One file per diagram, verbosity and theme. |
| `index.html` | Generated. Every diagram on one page with detail, layout and theme controls. |

Verbosity levels: `roles` prints the agent role under each step, `legend` prints verbs with a role legend, `verbs` prints verbs only.

## Regenerate

```
node docs/diagrams/render.mjs
```

No dependencies. Node 18 or later. Commit the generated files with the source.

## Style

Colours and type follow matthewfield.ca: OKLCH neutrals from its `tokens.css`, one hue per phase family, Fraunces for titles, Geist for labels, Geist Mono for eyebrows and badges. The SVGs name those fonts with system fallbacks, so they render everywhere and look best where the fonts are installed or loaded.

The loop and person marks are the `rotate-cw` and `user` icons from [Lucide](https://lucide.dev) (ISC licence), inlined in `render.mjs`.

## Canonical files

The chosen versions for docs, the site and slides are the `roles` verbosity, and the left-to-right journey:

- `svg/journey-lr-roles-light.svg` and `svg/journey-lr-roles-dark.svg`
- `svg/fsm-roles-light.svg` and `svg/fsm-roles-dark.svg`
- `svg/review-loop-roles-light.svg` and `svg/review-loop-roles-dark.svg`
- `svg/task-loop-roles-light.svg` and `svg/task-loop-roles-dark.svg`
- `svg/steering-roles-light.svg` and `svg/steering-roles-dark.svg`

The other verbosity levels and the top-to-bottom journey are still generated for anyone who wants them.

## Embedding

- GitHub markdown: `![The SDD journey](docs/diagrams/svg/journey-lr-verbs-light.svg)`.
- Both themes in one markdown image: use a `<picture>` element with `prefers-color-scheme` sources for the `-light` and `-dark` files.
- Slides: drop the SVG in directly, or export a PNG from a browser.
- `index.html` is self-contained apart from the Google Fonts link and works from a plain file server.
