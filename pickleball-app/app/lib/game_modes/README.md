Mode-specific MVC modules.

- `dupr/`
  - `model.ts`: DUPR state/domain models
  - `controller.ts`: DUPR orchestration/domain rules
  - `view.ts`: DUPR presentation helpers
- `rally/`
  - `model.ts`: Rally model aliases/types
  - `controller.ts`: Rally orchestration/domain rules
  - `view.ts`: Rally presentation helpers

Current app screens consume these modules through `useTournament` and page-level view helpers.
