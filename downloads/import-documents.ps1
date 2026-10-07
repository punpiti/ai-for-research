[CmdletBinding()]
param([string]$Workspace = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $Workspace 'input\original'
$targetDir = Join-Path $Workspace 'input\markdown'
New-Item -ItemType Directory -Force -Path $sourceDir,$targetDir | Out-Null

$coursePython = $null
$officeHelper = Join-Path $Workspace 'tools\import-office.py'
$onDemandReceipt = Join-Path $Workspace 'tools\on-demand-packages.jsonl'

function Get-CoursePython {
  if ($script:coursePython) { return $script:coursePython }
  $runtimeReceipt = Join-Path $Workspace 'tools\runtime-env.json'
  if (-not (Test-Path -LiteralPath $runtimeReceipt)) {
    throw 'Missing tools/runtime-env.json. Run the AI for Research setup again.'
  }
  $runtime = Get-Content -Raw -LiteralPath $runtimeReceipt | ConvertFrom-Json
  $recordedPath = [string]$runtime.env.PATH
  if ($recordedPath) { $env:PATH = $recordedPath }
  $candidate = [string]$runtime.python.executable
  if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) {
    throw 'The course Python recorded in tools/runtime-env.json is unavailable. Run setup Repair.'
  }
  $script:coursePython = $candidate
  return $script:coursePython
}

function Ensure-OfficeExtractor([string]$Kind) {
  $python = Get-CoursePython
  if (-not (Test-Path -LiteralPath $officeHelper)) { throw 'Missing tools/import-office.py. Run setup Repair.' }
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { throw 'Missing uv. Run setup Repair.' }
  if ($Kind -eq 'pptx') {
    $probe = 'import pptx'
    $spec = 'python-pptx>=1.0,<2'
  } else {
    $probe = 'import openpyxl'
    $spec = 'openpyxl>=3.1,<4'
  }
  & $python -c $probe 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "INSTALL_ON_DEMAND $spec into the course Python environment"
    & uv pip install --python $python $spec | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "Could not install $spec." }
  }
  return $python
}

foreach ($command in 'pandoc','tesseract','pdftotext','pdftoppm') {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Missing $command." }
}
$languages = (& tesseract --list-langs 2>&1) -join "`n"
if ($languages -notmatch '(?m)^tha$' -or $languages -notmatch '(?m)^eng$') {
  throw 'Tesseract Thai and English language data are required.'
}

$count = 0
Get-ChildItem -LiteralPath $sourceDir -File | Sort-Object Name | ForEach-Object {
  $source = $_
  $target = Join-Path $targetDir ($source.Name + '.md')
  $temporary = Join-Path ([IO.Path]::GetTempPath()) ("ai-research-import-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $temporary | Out-Null
  $extracted = Join-Path $temporary 'extracted.txt'
  $extractionMethod = 'direct-copy'
  try {
    switch ($source.Extension.ToLowerInvariant()) {
      '.md'   { Copy-Item -LiteralPath $source.FullName -Destination $extracted }
      '.txt'  { Copy-Item -LiteralPath $source.FullName -Destination $extracted }
      '.docx' { $extractionMethod = 'pandoc-gfm'; & pandoc $source.FullName -t gfm -o $extracted }
      '.pptx' {
        $python = Ensure-OfficeExtractor 'pptx'
        $method = (& $python $officeHelper $source.FullName $extracted --kind pptx --receipt $onDemandReceipt) -join ' '
        if ($LASTEXITCODE -ne 0) { throw "Could not extract $($source.Name)." }
        $extractionMethod = $method
      }
      '.xlsx' {
        $python = Ensure-OfficeExtractor 'xlsx'
        $method = (& $python $officeHelper $source.FullName $extracted --kind xlsx --receipt $onDemandReceipt) -join ' '
        if ($LASTEXITCODE -ne 0) { throw "Could not extract $($source.Name)." }
        $extractionMethod = $method
      }
      '.odt'  { $extractionMethod = 'pandoc-gfm'; & pandoc $source.FullName -t gfm -o $extracted }
      '.rtf'  { $extractionMethod = 'pandoc-gfm'; & pandoc $source.FullName -t gfm -o $extracted }
      '.html' { $extractionMethod = 'pandoc-gfm'; & pandoc $source.FullName -t gfm -o $extracted }
      '.htm'  { $extractionMethod = 'pandoc-gfm'; & pandoc $source.FullName -t gfm -o $extracted }
      '.pdf'  {
        $extractionMethod = 'poppler-pdftotext'
        & pdftotext -layout $source.FullName $extracted
        $text = if (Test-Path $extracted) { Get-Content -Raw $extracted } else { '' }
        $compactText = $text -replace '\s',''
        if ($compactText.Length -lt 20) {
          $extractionMethod = 'tesseract-ocr-tha+eng'
          Set-Content -Encoding utf8 $extracted ''
          & pdftoppm -png -r 300 $source.FullName (Join-Path $temporary 'page') | Out-Null
          Get-ChildItem $temporary -Filter 'page-*.png' | Sort-Object Name | ForEach-Object {
            (& tesseract $_.FullName stdout -l tha+eng 2>$null) | Add-Content -Encoding utf8 $extracted
            Add-Content -Encoding utf8 $extracted "`n"
          }
        }
      }
      { $_ -in '.png','.jpg','.jpeg','.tif','.tiff','.bmp','.webp' } {
        $extractionMethod = 'tesseract-ocr-tha+eng'
        (& tesseract $source.FullName stdout -l tha+eng 2>$null) | Set-Content -Encoding utf8 $extracted
      }
      default { Write-Host "SKIP unsupported: $($source.Name)"; return }
    }
    @(
      "# $($source.BaseName)",
      '',
      "> Source: ``$($source.Name)``  ",
      "> Extraction: ``$extractionMethod``  ",
      '> Imported automatically. Compare important claims with the original file.',
      '',
      (Get-Content -Raw $extracted)
    ) | Set-Content -Encoding utf8 $target
    Write-Host "CREATED input/markdown/$($source.Name).md"
    $count++
  }
  finally { Remove-Item -Recurse -Force $temporary -ErrorAction SilentlyContinue }
}
Write-Host "IMPORT_RESULT files=$count output=input/markdown"
