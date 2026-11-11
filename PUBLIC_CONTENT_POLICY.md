# Public Content Policy

This repository/folder is a deliberately small public export for GitHub Pages.

## Allowed

- Public landing-page copy
- Public learner requirements
- Public module titles and short descriptions
- Public setup/readiness instructions
- Reviewed learner-facing setup scripts and starter-workspace templates approved for Module 1
- Browser assets required to render those pages
- Public Google login shell that sends an ID token once to the same-origin classroom API; it contains no roster, stored credential, session secret, or account-state disclosure
- Public classroom catalogue/detail pages containing reviewed syllabus summaries and enrollment status, but no roster, private classroom content, learner work, or entitlement data
- Public JSON schemas and browser code used to validate learner submissions
- Explicitly labelled synthetic Module 8 journal profiles, bibliography records,
  data summaries, and LaTeX starter files used only for the publication exercise
- GitHub Pages deployment configuration

## Never publish here

- `.ai/` project state, logs, specifications, evals, or governance snapshots
- Internal syllabus/module source files
- Instructor prompts, answer keys, detailed facilitation logic, or internal rubrics
- Signing keys, private release operations, unpublished package pins, or internal installer runbooks
- Pilot participant data, student manuscripts, consent records, feedback, or research evidence
- Pricing strategy, operator notes, private contacts, credentials, tokens, or API keys
- Files copied from the completed `AI-for-research-reviews` project

## Module 1 progress submission

The Module 1 page sends a short readiness record only after the learner signs
in and has an active enrollment in the selected classroom. The record contains
four boolean checkpoint results, completion status, selected AI tool, elapsed
minutes, optional token usage, a submission UUID, and timestamps. It never
contains an API key, research file, research profile, prompt text, or learner
workspace path. Completed status requires all four checkpoints to pass; an
incomplete learner can still report `could_not_complete` so the instructor can
see where support is needed.

## Module 2 assessment submission

The Module 2 page validates a learner-created Markdown file and structured JSON
record in the browser, then sends only a pseudonymous JSON envelope to the site's
dedicated `/api/ai-for-research/module-2/submissions` endpoint when the instructor
has opened that class. The envelope contains a class code, learner-chosen call
sign, submission UUID, client timestamp, Markdown SHA-256, bounded progress
counts, deterministic machine-check results, token-report provenance, and a
short module evaluation. It does not contain Markdown, claims, learner answers,
open-question text, or evidence lists. The call sign must be newly created for the class and must not reuse
a real name or account username. The server reserves each call sign with a
random key, stores only its hash, and requires that key for later submissions
under the same call sign. The submission must not
contain a name, email address, phone number, student ID, unpublished research
material, or secrets. The Markdown file and complete submission JSON are read
locally and are never included in the request. Original evidence files and
workspace files also remain on the learner's computer.

Learning-content validation (claims, L1–L4, learner additions, and prompt-test
rules) runs in the learner's browser or local workspace before submission. The
public `downloads/validate-module-2.py` file is hosted centrally but uses only
the Python standard library and performs no network operation when run. The
server does not repeat that full educational schema validation; it validates
only the transport envelope, class state, call-sign credential, and bounded
fields required to keep stored records and deterministic statistics well formed.

The authenticated admin dashboard can open or close each class, set the expected
learner count, inspect submission progress, and view deterministic aggregate
statistics. Dashboard summaries use the latest submission per call sign while
retaining the count and history of all attempts. Provider-reported token counts,
learner estimates, and unavailable token data must remain separate.

## Module 3 progress submission

Module 3 papers, extracted Markdown, BibTeX abstracts, citation contexts,
classifications, problem statements, and research opportunities remain in the
learner workspace. The AI runs the public, standard-library-only
`downloads/validate-module-3.py` locally. The server receives only a completion
summary: route, boolean checks, bounded counts, artifact paths/SHA-256 values,
module evaluation, pseudonymous call sign, and timestamps. The progress schema
rejects extra content fields. The admin dashboard can open/close Module 3
separately and display latest-per-callsign progress and aggregate statistics.

## AIRR identity and Modules 1–3 progress submission

AIRR (AI for Research & Review) uses one revocable, class-scoped key for the
learner modules included in that classroom. The authenticated website creates
the key; the standard-library VS Code client stores it inside the learner's
workspace. The server stores only its SHA-256 digest, and keys expire after 90
days.

For Module 1, AIRR sends checklist state, completion status, tool/time and
optional token count. For Modules 2 and 3, local validators inspect the learner
artifacts and hashes, but AIRR sends only the existing bounded progress summary
and module evaluation. Markdown, claims, answers, papers, citation contexts,
research questions and evidence files remain local. The account and class from
the AIRR Key replace manual class-code and call-sign entry. The browser forms
remain available as a compatibility path for older workspaces.

## Module 7 highlights submission

Module 7 uses the same AIRR identity. A learner connects the standard-library
VS Code client once; the key is shown once on the authenticated website.

AIRR sends `module-07-highlights.md` and one to five PNG, JPEG or WebP graphs
from the supplied mock-data exercise. Each graph is limited to 2 MB and the
combined graph payload to 8 MB. Raw data, analysis code, unrelated workspace
files and research material are excluded. The client validates the artifacts,
shows the submission boundary, asks for confirmation and stores its private
configuration with mode 600 where supported. Instructors view the submitted
Markdown and graphs through an enrollment-protected AIRR review page.

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
