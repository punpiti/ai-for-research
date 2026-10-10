#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
page="$root/login.html"

grep -q 'data-google-login' "$page"
grep -q 'assets/dev-auth.js' "$page"
grep -q 'https://accounts.google.com/gsi/client' "$page"
grep -q 'name="google-signin-client-id"' "$page"
if grep -Eq 'Development login|data-dev-login|student-00[1-5]@ku\.th|instructor-00[1-2]@ku\.th|admin@ku\.th' "$page"; then
  echo 'Production login HTML must not contain development login controls or dummy accounts.' >&2
  exit 1
fi
grep -q 'role="status" aria-live="polite"' "$page"
grep -q 'noindex,nofollow' "$page"
grep -q 'body class="login-body"' "$page"
grep -q '/api/ai-for-research/classrooms/auth/google' "$root/assets/login.js"
if grep -Eq 'auth/preview|Development login|student-00[1-5]@ku\.th|instructor-00[1-2]@ku\.th|admin@ku\.th' "$root/assets/login.js"; then
  echo 'Production login JavaScript must not contain preview endpoints or dummy accounts.' >&2
  exit 1
fi
grep -q 'aiResearchPreviewLogin' "$root/assets/login.js"
grep -q 'credentials: "same-origin"' "$root/assets/login.js"
grep -q 'google.accounts.id.initialize' "$root/assets/login.js"
grep -q 'google.accounts.id.renderButton' "$root/assets/login.js"
grep -q 'login-body .*module-menu.*display: none' "$root/assets/styles.css"
if grep -Eq 'localStorage|sessionStorage' "$root/assets/login.js"; then
  echo 'Login page must not store identity or tokens in browser storage.' >&2
  exit 1
fi

node "$root/scripts/test-login.js"
node "$root/scripts/test-dev-auth.js"
echo 'Login page checks passed.'
