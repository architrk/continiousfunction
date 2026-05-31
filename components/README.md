# Components

Component folders are organized by ownership and reuse level. Prefer importing with the repo alias, for example `@/components/charts/TimeSeriesPlot`.

- `app/`: application shell components such as the global layout.
- `shared/`: generic cross-feature utilities such as error boundaries.
- `explorable/`: scroll-synced explorable article layout primitives.
- `charts/`: reusable low-level canvas/SVG chart primitives.
- `graphs/`: D3 graph components and graph page wrappers.
- `foundations/`: concept-specific foundation visualizations and demos.
- `concepts/`: domain concept page composition.
- `editorial/`: notebook/editorial page composition.
- `home/`: homepage-only sections.
- `site/`: reusable site chrome and content panels.
- `viz/`: shared visualization framing components.
