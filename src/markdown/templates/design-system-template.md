# Design System

> **Steering, not spec.** This document captures the *durable direction and rules* of the
> visual system — principles, semantic roles, usage rules, governance, and non-negotiable
> gates. The *concrete values that churn* (exact palette/token values, the precise type scale,
> per-component and per-surface decisions) belong in the design spec / implementation and in the
> token source of truth — not here. A **direction-light** design system is valid and useful:
> fill in only what is genuinely decided and durable.
>
> For any section, **`Deferred: <where/when it will be decided>`** is a first-class answer —
> use it instead of committing a value you are not ready to lock in.

## Purpose
[What visual and interaction consistency should this system guarantee, and why? State the
direction at a high level; leave exact values to the design spec / implementation.]

## Scope: What Belongs Here vs. in a Spec (optional)
- **Here (steering):** principles, semantic roles, usage rules, accessibility/perf/theme gates, governance.
- **In a spec / in code:** exact palette and token values, the precise type scale, per-component
  and per-surface decisions, the token source of truth.
- **Don't restate the other steering docs** — cross-reference product/tech/structure for vision,
  token mechanism, or file locations rather than duplicating them here.

## Design Principles
[Durable, cross-cutting principles that guide every visual and interaction decision.]

1. **Principle 1**: [e.g., Clarity over decoration]
2. **Principle 2**: [e.g., Consistency across surfaces]
3. **Principle 3**: [e.g., Accessible by default]

## Color
[Define the *roles* and *rules*, not the hex values. Where a palette is decided, point to the
token source of truth rather than copying values here.]

- **Semantic roles**: [the roles your system uses — e.g. primary, surface, text, border, success, warning, danger. Name the roles, not the hexes.]
- **Usage rules**: [when each role applies; required contrast and theme behavior]
- **Theming**: [light/dark or brand approach and parity expectations]
- **Concrete values**: [`Deferred: decided in the design spec / lives in <token source>`]

## Typography
[Roles and rules over exact sizes.]

- **Type roles**: [e.g. display, heading levels, body, caption — and when each is used]
- **Font families**: [primary, monospace, fallbacks — direction]
- **Usage rules**: [weight/casing conventions, hierarchy rules]
- **Exact scale**: [`Deferred: …` or point to the token source]

## Spacing & Layout
- **Spacing approach**: [the scale's *shape* — e.g. a single consistent base unit — over exact numbers]
- **Grid / breakpoints**: [layout and responsive direction]
- **Density**: [comfortable vs. compact conventions, if decided]
- **Motion (optional)**: [animation direction — easing/duration intent, when to animate vs. stay static. Reduced-motion handling is covered under Accessibility.]

## Components
[Cross-cutting *conventions*, not a component catalog. Per-component specifics belong in specs.]

- **Naming & structure**: [how components are named and composed]
- **Required states**: [which states every interactive component MUST handle — e.g. focus, disabled, loading, error]
- **Variant policy**: [how variants are introduced and constrained — not the full variant list]
- **Component library**: [reference the shared library / source of truth, if one exists]

## Accessibility & Non-Negotiable Gates
[Cross-cutting bars every UI spec must clear — gates, not aspirations.]

- **Accessibility**: [e.g. WCAG AA contrast, visible focus, full keyboard support, reduced-motion support]
- **Other gates (optional)**: [performance budgets, theme parity, i18n/RTL — true non-negotiables only]

## Design Tokens (source of truth)
[Where tokens *live* and how code consumes them, so steering points at values instead of duplicating them.]

- **Source of truth**: [token file / design-tool export — the authority for concrete values]
- **Consumption**: [how tokens map to CSS variables / theme objects]
- **Naming convention**: [token naming rules]

## Governance & Ownership (optional)
[Who owns the system; how changes are proposed/approved; how specs request additions.]

## Deferred Decisions
[Direction-light is fine. Record what is intentionally NOT decided yet and where it will be
resolved, so downstream specs know what is open.]

- [Decision]: [`Deferred: to be decided in <spec/phase>` — or an open question]

## Voice & Tone (if applicable)
[Microcopy and content conventions that affect the interface.]
