# Centinela Design Context

## Scene

An analyst reviews Paraguay public-record leads on a laptop or desktop in a quiet work session, needing confidence, traceability, and low visual drama while moving from a company dossier into source evidence.

## Register

Product UI. Design serves the investigation task.

## Color Strategy

Restrained. Use warm paper neutrals, one deep green action/accent, and a small amber review accent for source caution or guidance. Prefer OKLCH tokens and tinted neutrals. Do not use pure black or pure white.

## Typography

Use a native system sans stack for product trust and density. Keep prose line lengths readable. Use weight, spacing, and modest scale changes for hierarchy rather than decorative type.

## Components

The Command Center uses:

- app shell navigation
- guided proof-path steps
- panels and source-backed cards
- chips for review state and limits
- readable case packets
- graph-ready relationship visualization
- raw JSON details as a fallback, not the primary surface

Cards should be used where they separate evidence roles or workflow states. Avoid identical decorative grids.

## Interaction Rules

Every interactive control needs visible hover and keyboard focus states. Motion should be fast and stateful only. Do not animate layout properties.

## Language Rules

Use `lead`, `signal`, `candidate`, `identity context`, `source record`, `evidence link`, `limitation`, and `requires review`.

Do not use language implying guilt, wrongdoing, corruption findings, legal conclusions, ownership conclusions, or automatic public allegations.

## Shipping Gates

Before treating an interface change as done:

- the guided proof path still opens dossier, case packet, artifacts, and methodology
- accepted matches, review candidates, diagnostics, and risk signals remain visually distinct
- source limitations and publication gates remain visible
- `npm run smoke:command-center` passes against the live local surface
