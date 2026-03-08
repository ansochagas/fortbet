param(
  [string]$BaseUrl = "https://monacoloterias.ddns.net",
  [string]$Usuario = $env:MONACO_LOGIN,
  [string]$Senha = $env:MONACO_SENHA,
  [string]$DataReferencia = (Get-Date -Format "yyyy-MM-dd"),
  [string]$OutputPath = "public/comercial-sync/latest.json"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Usuario) -or [string]::IsNullOrWhiteSpace($Senha)) {
  throw "Informe usuario e senha via parametros -Usuario/-Senha ou variaveis MONACO_LOGIN e MONACO_SENHA."
}

function Get-HiddenFieldValue {
  param(
    [string]$Html,
    [string]$Name
  )

  $pattern = 'name="' + [regex]::Escape($Name) + '"[^>]*value="([^"]*)"'
  $match = [regex]::Match($Html, $pattern, "IgnoreCase")
  if ($match.Success) {
    return $match.Groups[1].Value
  }
  return ""
}

function Get-SelectValue {
  param(
    [string]$Html,
    [string]$ElementId
  )

  $selectPattern = '<select[^>]*id="' + [regex]::Escape($ElementId) + '"[^>]*>(.*?)</select>'
  $selectMatch = [regex]::Match($Html, $selectPattern, "Singleline,IgnoreCase")
  if (-not $selectMatch.Success) {
    return ""
  }

  $optionsHtml = $selectMatch.Groups[1].Value
  $selectedMatch = [regex]::Match($optionsHtml, '<option[^>]*selected[^>]*value="([^"]*)"', "IgnoreCase")
  if ($selectedMatch.Success) {
    return $selectedMatch.Groups[1].Value
  }

  $firstMatch = [regex]::Match($optionsHtml, '<option[^>]*value="([^"]*)"', "IgnoreCase")
  if ($firstMatch.Success) {
    return $firstMatch.Groups[1].Value
  }

  return ""
}

function Strip-Html {
  param([string]$Value)

  $decoded = [System.Net.WebUtility]::HtmlDecode([string]$Value)
  $withoutTags = [regex]::Replace($decoded, "<[^>]+>", " ")
  return [regex]::Replace($withoutTags, "\s+", " ").Trim()
}

function Convert-MoneyToNumber {
  param([string]$Value)

  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return 0.0
  }

  $normalized = $raw -replace "\s+", ""
  $normalized = $normalized -replace "R\$", ""
  $normalized = $normalized -replace "\.", ""
  $normalized = $normalized -replace ",", "."
  $normalized = $normalized -replace "[^\d\.-]", ""

  [double]$parsed = 0.0
  $ok = [double]::TryParse(
    $normalized,
    [System.Globalization.NumberStyles]::Float,
    [System.Globalization.CultureInfo]::InvariantCulture,
    [ref]$parsed
  )

  if ($ok) {
    return [math]::Round($parsed, 2)
  }

  return 0.0
}

function Resolve-OutputPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginUrl = $BaseUrl.TrimEnd("/") + "/Login"
$caixaUrl = $BaseUrl.TrimEnd("/") + "/CaixaVendedor"

$loginPage = Invoke-WebRequest -Uri $loginUrl -WebSession $session -UseBasicParsing

$loginForm = @{
  "__VIEWSTATE" = Get-HiddenFieldValue -Html $loginPage.Content -Name "__VIEWSTATE"
  "__VIEWSTATEGENERATOR" = Get-HiddenFieldValue -Html $loginPage.Content -Name "__VIEWSTATEGENERATOR"
  "__EVENTVALIDATION" = Get-HiddenFieldValue -Html $loginPage.Content -Name "__EVENTVALIDATION"
  "usuario" = $Usuario
  "senha" = $Senha
  "brnLogin" = "Login"
}

Invoke-WebRequest -Uri $loginUrl -Method POST -Body $loginForm -WebSession $session -UseBasicParsing -MaximumRedirection 10 | Out-Null

$homePage = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/") -WebSession $session -UseBasicParsing
if ($homePage.Content -notmatch "lblUsuario") {
  throw "Login nao confirmado. Verifique usuario/senha."
}

$caixaPage = Invoke-WebRequest -Uri $caixaUrl -WebSession $session -UseBasicParsing

$searchForm = @{
  "__VIEWSTATE" = Get-HiddenFieldValue -Html $caixaPage.Content -Name "__VIEWSTATE"
  "__VIEWSTATEGENERATOR" = Get-HiddenFieldValue -Html $caixaPage.Content -Name "__VIEWSTATEGENERATOR"
  "__EVENTVALIDATION" = Get-HiddenFieldValue -Html $caixaPage.Content -Name "__EVENTVALIDATION"
  "ctl00`$ContentPlaceHolderMaster`$data" = $DataReferencia
  "ctl00`$ContentPlaceHolderMaster`$dataH" = ""
  "ctl00`$ContentPlaceHolderMaster`$DropDownListRegiao" = Get-SelectValue -Html $caixaPage.Content -ElementId "ContentPlaceHolderMaster_DropDownListRegiao"
  "ctl00`$ContentPlaceHolderMaster`$dropDownListArea" = Get-SelectValue -Html $caixaPage.Content -ElementId "ContentPlaceHolderMaster_dropDownListArea"
  "ctl00`$ContentPlaceHolderMaster`$dropDownListVendedor" = Get-SelectValue -Html $caixaPage.Content -ElementId "ContentPlaceHolderMaster_dropDownListVendedor"
  "ctl00`$ContentPlaceHolderMaster`$btnBuscar" = "Buscar"
}

$caixaResult = Invoke-WebRequest -Uri $caixaUrl -Method POST -Body $searchForm -WebSession $session -UseBasicParsing

$tableMatch = [regex]::Match(
  $caixaResult.Content,
  '<table[^>]*id="ContentPlaceHolderMaster_gridviewCaixa"[^>]*>(.*?)</table>',
  "Singleline,IgnoreCase"
)

if (-not $tableMatch.Success) {
  throw "Tabela ContentPlaceHolderMaster_gridviewCaixa nao encontrada."
}

$rows = @()
$rowMatches = [regex]::Matches($tableMatch.Groups[1].Value, "<tr[^>]*>(.*?)</tr>", "Singleline,IgnoreCase")

foreach ($rowMatch in $rowMatches) {
  $rowHtml = $rowMatch.Groups[1].Value
  if ($rowHtml -match "<th") {
    continue
  }

  $cells = [regex]::Matches($rowHtml, "<td[^>]*>(.*?)</td>", "Singleline,IgnoreCase")
  if ($cells.Count -lt 4) {
    continue
  }

  $areaRaw = Strip-Html -Value $cells[1].Groups[1].Value
  $vendedor = Strip-Html -Value $cells[2].Groups[1].Value
  $vendidoRaw = Strip-Html -Value $cells[3].Groups[1].Value

  if ([string]::IsNullOrWhiteSpace($areaRaw) -or [string]::IsNullOrWhiteSpace($vendedor)) {
    continue
  }

  $areaCodeMatch = [regex]::Match($areaRaw, "\d{2}")
  $areaCode = if ($areaCodeMatch.Success) { $areaCodeMatch.Value } else { "" }

  $rows += [PSCustomObject]@{
    areaRaw = $areaRaw
    areaCode = $areaCode
    vendedor = $vendedor
    vendidoRaw = $vendidoRaw
    vendido = Convert-MoneyToNumber -Value $vendidoRaw
  }
}

$totalVendido = [math]::Round((($rows | Measure-Object -Property vendido -Sum).Sum), 2)
$areasResumo = $rows |
  Group-Object -Property areaCode |
  Sort-Object -Property Name |
  ForEach-Object {
    [PSCustomObject]@{
      areaCode = $_.Name
      totalCambistas = $_.Count
      totalVendido = [math]::Round((($_.Group | Measure-Object -Property vendido -Sum).Sum), 2)
    }
  }

$payload = [PSCustomObject]@{
  source = "monaco-caixa-vendedor"
  baseUrl = $BaseUrl
  snapshotDate = $DataReferencia
  fetchedAt = (Get-Date).ToString("o")
  generatedBy = "scripts/Sync-ComercialOnline.ps1"
  rows = $rows
  totals = [PSCustomObject]@{
    totalCambistas = $rows.Count
    totalVendido = $totalVendido
    areas = $areasResumo
  }
}

$finalOutputPath = Resolve-OutputPath -Path $OutputPath
$outputDir = Split-Path -Parent $finalOutputPath
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -Path $finalOutputPath -Encoding UTF8

Write-Output "Snapshot salvo em: $finalOutputPath"
Write-Output "Cambistas: $($rows.Count) | Vendido: R$ $($totalVendido.ToString('N2', [System.Globalization.CultureInfo]::GetCultureInfo('pt-BR')))"
