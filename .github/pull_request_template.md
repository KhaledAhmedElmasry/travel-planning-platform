## Requirements

<!-- e.g. FLT-11, FLT-12 (and the page id for frontend work, e.g. P-12). Use "Closes #<issue>" only when the whole requirement is done, otherwise "Part of #<issue>". -->

## What Changed

-

## How to Test

<!-- Backend: the steps in Swagger (http://localhost:3000/api/docs).
     Frontend: the steps in the browser (http://localhost:3001/...), for every role that can open the page,
     including the loading, empty and error states. Add screenshots (desktop and mobile). -->

1.

## Checklist

- [ ] Branch is up to date with `develop`
- [ ] Only my own files changed (frontend: the files of my part; ask the team leader before touching a shared file)
- [ ] Backend: `npm run lint`, `npm run build` and `npm test` pass
- [ ] Frontend: `npm run lint`, `npm run typecheck` and `npm run build` pass
- [ ] Validation and authorization are enforced in the backend (the frontend only mirrors them)
- [ ] Endpoints match `docs/api/openapi.yaml`, and the file is updated for every added or changed endpoint
- [ ] Frontend: the page uses a shell and kit components, keeps its header comment (requirement ids, endpoints, rendering strategy) and follows that rendering strategy
- [ ] No secrets, `.env` or unrelated changes
- [ ] `AI_PROMPTS.txt` updated (if AI was used)
