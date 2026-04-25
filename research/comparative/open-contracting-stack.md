# Open Contracting stack, including Cardinal

## Snapshot

The Open Contracting stack provides the OCDS data standard, implementation guidance, and now Cardinal, an open-source library for calculating procurement red flags against OCDS data.

## Strong ideas

- standardize procurement data before building analytics
- separate coverage checks, data preparation, and indicator calculation
- keep red flags tied to explicit formulas and field dependencies
- support cross-country reuse through OCDS

## Limits for Paraguay

- Not every useful local signal will fit existing Cardinal formulas.
- OCDS compliance in practice still needs local adaptation and data-quality handling.

## Adopt now

- OCDS as the analytical backbone for procurement
- data-quality awareness before indicator calculation
- stable rule identifiers and rule documentation

## Defer or adapt

- direct Cardinal integration until the DNCP local normalization layer is stable

## Role in Centinela

This is the main analytical backbone reference. Centinela's procurement logic should remain compatible in spirit with OCDS-first red-flag computation.

