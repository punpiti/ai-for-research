# Public Content Policy

This repository/folder is a deliberately small public export for GitHub Pages.

## Allowed

- Public landing-page copy
- Public learner requirements
- Public module titles and short descriptions
- Public setup/readiness instructions
- Reviewed learner-facing setup scripts and starter-workspace templates approved for Module 1
- Browser assets required to render those pages
- GitHub Pages deployment configuration

## Never publish here

- `.ai/` project state, logs, specifications, evals, or governance snapshots
- Internal syllabus/module source files
- Instructor prompts, answer keys, detailed facilitation logic, or internal rubrics
- Signing keys, private release operations, unpublished package pins, or internal installer runbooks
- Pilot participant data, student manuscripts, consent records, feedback, or research evidence
- Pricing strategy, operator notes, private contacts, credentials, tokens, or API keys
- Files copied from the completed `AI-for-research-reviews` project

Public copy is maintained separately. Do not build the site by recursively copying
the private course workspace.

## Unlinked pages

`index-with-pricing.html` is the priced/checkout version of the homepage, kept in
the public export but intentionally not linked from `index.html`, `site-header`,
`site-footer`, `robots.txt`, or any nav. It's only reachable by someone who already
has the exact URL. It carries `noindex,nofollow` so search engines don't surface
it. This exists because the course/program is not yet approved to sell — swap it
back in as `index.html` once approval and pricing are final, and remove or update
this note.
