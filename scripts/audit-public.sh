#!/usr/bin/env bash
set -euo pipefail

site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

allowed_pattern='^(\.nojekyll|404\.html|index\.html|index-with-pricing\.html|og-image\.png|register\.html|checkout\.html|prepare\.html|module-[2-9]\.html|module-7-thailand-population-lab\.html|module-8-publication-demo\.html|hunger-research-methodology\.html|robots\.txt|PUBLIC_CONTENT_POLICY\.md|assets/(styles\.css|app\.js|site-shell\.js|registration\.js|course-cart\.js|checkout\.js|publication-demo\.css|publication-demo\.js|images/hunger-research-facebook-original\.jpg)|downloads/(setup-windows\.ps1|setup-macos\.sh|setup-linux\.sh|modern-thai\.yaml|modern-thai\.lua|modern-thai\.tex|starter-AGENTS\.md|import-documents\.(sh|ps1)|module-0[5-9]-[a-z0-9-]+\.md|fonts/(Sarabun-(Regular|Bold)\.ttf|OFL\.txt))|scripts/(deploy-urban\.sh|audit-public\.sh|test-installers\.sh|test-prepare-page\.sh|test-learner-content\.sh|test-installer-behavior\.sh|test-installer-behavior\.ps1)|\.github/workflows/(pages|installer-tests)\.yml)$'

status=0
while IFS= read -r path; do
  relative="${path#"${site_root}/"}"
  if [[ ! "${relative}" =~ ${allowed_pattern} ]]; then
    echo "Unexpected public file: ${relative}" >&2
    status=1
  fi
done < <(find "${site_root}" -type f -not -path '*/.git/*' | sort)

forbidden='(API[_ -]?KEY|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|04_review_notes|SESSION_LOG|PROJECT_STATE|pricing strategy|participant data)'
if grep -RInE "${forbidden}" "${site_root}" \
  --exclude='audit-public.sh' \
  --exclude='PUBLIC_CONTENT_POLICY.md' \
  --exclude-dir='.git'; then
  echo "Potential private/internal content found in public files." >&2
  status=1
fi

exit "${status}"
