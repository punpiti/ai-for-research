#!/usr/bin/env bash
set -euo pipefail

site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

allowed_pattern='^(\.nojekyll|404\.html|index\.html|index-with-pricing\.html|og-image\.png|register\.html|checkout\.html|login\.html|classroom\.html|prepare\.html|module-[2-9]\.html|module-2-food-case\.html|module-7-thailand-population-lab\.html|module-8-publication-demo\.html|hunger-research-methodology\.html|robots\.txt|PUBLIC_CONTENT_POLICY\.md|\.gitignore|assets/(styles\.css|app\.js|site-shell\.js|dev-auth\.js|login\.js|classroom\.js|module-[1237]-submission\.js|submission-defaults\.js|module-[1237]-steps\.js|module-guided-steps\.js|registration\.js|course-cart\.js|checkout\.js|publication-demo\.css|publication-demo\.js|images/hunger-research-facebook-original\.jpg)|downloads/(setup-windows\.ps1|setup-macos\.sh|setup-linux\.sh|setup-module-07-(windows\.ps1|macos\.sh|linux\.sh)|setup-module-07\.py|setup-runtime\.py|setup-summary\.py|setup-vscode-wsl\.ps1|validate-module-[23]\.py|modern-thai\.yaml|modern-thai\.lua|modern-thai\.tex|starter-(AGENTS|STARTUP|TOKEN-DISCIPLINE|TOKEN-BUDGET|PROJECT-STATE)\.md|import-documents\.(sh|ps1)|import-office\.py|module-0[5-9]-[a-z0-9-]+\.md|module-08-mock-(references\.bib|report\.tex)|course-materials\.json|course-materials/visualization/(fonts/(Sarabun-(Regular|Bold)\.ttf|OFL\.txt)|notebooks/(module-07-data-visualization\.ipynb|module-07a-read-and-audit\.ipynb|module-07b-revise-and-publish\.ipynb|module-07c-matplotlib-foundations\.ipynb|module-07-environment\.yml|module-07-requirements\.txt|module-07-standalone-setup\.md)|templates/(module-07-data-analysis-visualization-workbook\.md|module-07-visualization-workflow-and-prompts\.md)|examples/figure-consistency/(README\.md|mock-article-figure-consistency\.pdf|mock-study-data\.csv|figure-consistency-audit-template\.md))|module-02-submission-(schema|example)\.json|module-03-completion-(schema|example)\.json|module-02-food-evidence\.zip|module-02-food-evidence/(README\.md|01-lunch-brief-th\.pdf|02-menu-observations\.xlsx|03-omelette-recipe-bilingual\.docx|04-lunch-tray\.png|05-canteen-reviews\.html|06-web-source\.txt|07-mock-nutrition\.csv|08-example-meal-card\.md)|module-07-figure-consistency/(README\.md|figure-consistency-audit-template\.md|mock-article-figure-consistency\.pdf|mock-study-data\.csv|module-07-submission-schema\.json)|module-07-notebooks/(module-07-data-visualization\.ipynb|module-07a-read-and-audit\.ipynb|module-07b-revise-and-publish\.ipynb|module-07c-matplotlib-foundations\.ipynb|module-07-notebook-bundle\.zip|module-07-environment\.yml|module-07-requirements\.txt|module-07-standalone-setup\.md)|fonts/(Sarabun-(Regular|Bold)\.ttf|OFL\.txt))|scripts/(deploy-urban\.sh|audit-public\.sh|test-dev-auth\.js|test-login-page\.sh|test-login\.js|test-classroom-page\.sh|test-classroom\.js|test-installers\.sh|test-prepare-page\.sh|test-learner-content\.sh|test-project-name\.sh|test-module-[1237]-submission\.js|test-installer-behavior\.sh|test-installer-behavior\.ps1|test-windows-system-tools\.ps1|test-windows-uninstall\.ps1|test-runtime\.py|test-wsl-vscode\.sh)|\.github/workflows/(pages|installer-tests)\.yml)$'

status=0
while IFS= read -r path; do
  relative="${path#"${site_root}/"}"
  case "${relative}" in
    admin/index.html|admin/airr.html|assets/instructor-admin.js|assets/airr-connect.js|assets/airr-instructor.js|assets/module-3-access.js|assets/my-learning.js|scripts/test-instructor-admin.js|scripts/test-instructor-admin-page.sh|scripts/test-my-learning.js|scripts/test-module-7-cli.py|downloads/course-materials/visualization/tools/ai-for-research-course.py) continue ;;
    downloads/course-materials-module-08.json|downloads/setup-module-08.py|downloads/setup-module-08-linux.sh|downloads/setup-module-08-macos.sh|downloads/setup-module-08-windows.ps1|downloads/course-materials/document-production/*|scripts/test-module-8-installer.py|scripts/test-module-7-8-platforms.py|downloads/module-04-mock/mock-paper.pdf|downloads/module-04-mock/mock-paper.md) continue ;;
  esac
  if [[ ! "${relative}" =~ ${allowed_pattern} ]]; then
    echo "Unexpected public file: ${relative}" >&2
    status=1
  fi
done < <(find "${site_root}" -type f -not -path '*/.git/*' -not -path '*/__pycache__/*' | sort)

forbidden='(API[_ -]?KEY|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|04_review_notes|SESSION_LOG|pricing strategy|participant data)'
if grep -RInE "${forbidden}" "${site_root}" \
  --exclude='audit-public.sh' \
  --exclude='PUBLIC_CONTENT_POLICY.md' \
  --exclude-dir='.git'; then
  echo "Potential private/internal content found in public files." >&2
  status=1
fi

exit "${status}"
