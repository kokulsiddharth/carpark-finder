$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Convert-Svy21ToWgs84([double]$E, [double]$N) {
  $a = 6378137.0
  $f = 1.0 / 298.257223563
  $oLat = 1.366666 * [Math]::PI / 180.0
  $oLon = 103.833333 * [Math]::PI / 180.0
  $oN = 38744.572
  $oE = 28001.642
  $k = 1.0
  $b = $a * (1.0 - $f)
  $e2 = 2.0 * $f - $f * $f
  $e4 = $e2 * $e2
  $e6 = $e4 * $e2
  $A0 = 1.0 - $e2 / 4.0 - (3.0 * $e4) / 64.0 - (5.0 * $e6) / 256.0
  $A2 = (3.0 / 8.0) * ($e2 + $e4 / 4.0 + (15.0 * $e6) / 128.0)
  $A4 = (15.0 / 256.0) * ($e4 + (3.0 * $e6) / 4.0)
  $A6 = (35.0 * $e6) / 3072.0
  $n = ($a - $b) / ($a + $b)
  $n2 = $n * $n
  $n3 = $n2 * $n
  $G = $a * (1.0 - $n) * (1.0 - $n2) * (1.0 + (9.0 * $n2) / 4.0 + (225.0 * $n3) / 64.0) * ([Math]::PI / 180.0)
  $calcM = $a * ($A0 * $oLat - $A2 * [Math]::Sin(2.0 * $oLat) + $A4 * [Math]::Sin(4.0 * $oLat) - $A6 * [Math]::Sin(6.0 * $oLat))
  $Nprime = $N - $oN
  $Mprime = $calcM + $Nprime / $k
  $sigma = ($Mprime / $G) * ([Math]::PI / 180.0)
  $latPrime = $sigma +
    ((3.0 * $n) / 2.0 - (27.0 * $n3) / 32.0) * [Math]::Sin(2.0 * $sigma) +
    ((21.0 * $n2) / 16.0 - (55.0 * $n3) / 32.0) * [Math]::Sin(4.0 * $sigma) +
    ((151.0 * $n3) / 96.0) * [Math]::Sin(6.0 * $sigma)
  $sinLatPrime = [Math]::Sin($latPrime)
  $rhoPrime = ($a * (1.0 - $e2)) / [Math]::Pow(1.0 - $e2 * $sinLatPrime * $sinLatPrime, 1.5)
  $vPrime = $a / [Math]::Sqrt(1.0 - $e2 * $sinLatPrime * $sinLatPrime)
  $psiPrime = $vPrime / $rhoPrime
  $tPrime = [Math]::Tan($latPrime)
  $Eprime = $E - $oE
  $x = $Eprime / ($k * $vPrime)
  $T1 = ($tPrime / ($k * $rhoPrime)) * ($Eprime * $x / 2.0)
  $T2 = ($tPrime / ($k * $rhoPrime)) * ($Eprime * [Math]::Pow($x, 3) / 24.0) * (-4.0 * $psiPrime * $psiPrime + 9.0 * $psiPrime * (1.0 - $tPrime * $tPrime) + 12.0 * $tPrime * $tPrime)
  $T3 = ($tPrime / ($k * $rhoPrime)) * ($Eprime * [Math]::Pow($x, 5) / 720.0) * (8.0 * [Math]::Pow($psiPrime, 4) * (11.0 - 24.0 * $tPrime * $tPrime) - 12.0 * [Math]::Pow($psiPrime, 3) * (21.0 - 71.0 * $tPrime * $tPrime) + 15.0 * $psiPrime * $psiPrime * (15.0 - 98.0 * $tPrime * $tPrime + 15.0 * [Math]::Pow($tPrime, 4)) + 180.0 * $psiPrime * (5.0 * $tPrime * $tPrime - 3.0 * [Math]::Pow($tPrime, 4)) + 360.0 * [Math]::Pow($tPrime, 4))
  $T4 = ($tPrime / ($k * $rhoPrime)) * ($Eprime * [Math]::Pow($x, 7) / 40320.0) * (1385.0 - 3633.0 * $tPrime * $tPrime + 4095.0 * [Math]::Pow($tPrime, 4) + 1575.0 * [Math]::Pow($tPrime, 6))
  $lat = $latPrime - $T1 + $T2 - $T3 + $T4
  $secLatPrime = 1.0 / [Math]::Cos($latPrime)
  $D1 = $x * $secLatPrime
  $D2 = ([Math]::Pow($x, 3) * $secLatPrime) / 6.0 * ($psiPrime + 2.0 * $tPrime * $tPrime)
  $D3 = ([Math]::Pow($x, 5) * $secLatPrime) / 120.0 * (-4.0 * [Math]::Pow($psiPrime, 3) * (1.0 - 6.0 * $tPrime * $tPrime) + $psiPrime * $psiPrime * (9.0 - 68.0 * $tPrime * $tPrime) + 72.0 * $psiPrime * $tPrime * $tPrime + 24.0 * [Math]::Pow($tPrime, 4))
  $D4 = ([Math]::Pow($x, 7) * $secLatPrime) / 5040.0 * (61.0 + 662.0 * $tPrime * $tPrime + 1320.0 * [Math]::Pow($tPrime, 4) + 720.0 * [Math]::Pow($tPrime, 6))
  $lon = $oLon + $D1 - $D2 + $D3 - $D4
  return @{
    lat = [Math]::Round($lat * 180.0 / [Math]::PI, 7)
    lng = [Math]::Round($lon * 180.0 / [Math]::PI, 7)
  }
}

function Escape-Json([string]$s) {
  if ($null -eq $s) { return "" }
  return $s.Replace("\", "\\").Replace('"', '\"').Replace("`r", "").Replace("`n", "\n")
}

function Json-NullOrNumber($v) {
  if ($null -eq $v) { return "null" }
  return ([double]$v).ToString([Globalization.CultureInfo]::InvariantCulture)
}

function Write-Carparks($hdbParts, $mallParts) {
  $outDir = Join-Path $root "data"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $generated = (Get-Date).ToUniversalTime().ToString("o")
  $json = '{"generatedAt":"' + $generated + '","hdb":[' + ($hdbParts -join ",") + '],"malls":[' + ($mallParts -join ",") + "]}"
  [System.IO.File]::WriteAllText((Join-Path $outDir "carparks.json"), $json, [Text.UTF8Encoding]::new($false))
  Write-Host "Wrote data/carparks.json"
}

$hdb = Get-Content (Join-Path $root "hdb-raw.json") -Raw | ConvertFrom-Json
$hdbParts = New-Object System.Collections.Generic.List[string]
foreach ($r in $hdb.result.records) {
  $xy = Convert-Svy21ToWgs84 ([double]$r.x_coord) ([double]$r.y_coord)
  $hdbParts.Add(
    ('{"id":"' + (Escape-Json $r.car_park_no) + '","source":"hdb","name":"' + (Escape-Json $r.car_park_no) +
      '","address":"' + (Escape-Json $r.address) + '","lat":' + $xy.lat.ToString([Globalization.CultureInfo]::InvariantCulture) +
      ',"lng":' + $xy.lng.ToString([Globalization.CultureInfo]::InvariantCulture) +
      ',"carParkType":"' + (Escape-Json $r.car_park_type) + '","parkingSystem":"' + (Escape-Json $r.type_of_parking_system) +
      '","shortTerm":"' + (Escape-Json $r.short_term_parking) + '","freeParking":"' + (Escape-Json $r.free_parking) +
      '","nightParking":"' + (Escape-Json $r.night_parking) + '","decks":' + ([int]$r.car_park_decks) +
      ',"gantryHeight":' + ([double]$r.gantry_height).ToString([Globalization.CultureInfo]::InvariantCulture) +
      ',"basement":' + ($(if ($r.car_park_basement -eq "Y") { "true" } else { "false" })) + "}")
  )
}
Write-Host "HDB parks: $($hdbParts.Count)"

$lta = Get-Content (Join-Path $root "lta-rates-raw.json") -Raw | ConvertFrom-Json
$mallRows = @($lta.result.records)
$mallMeta = foreach ($r in $mallRows) {
  [pscustomobject]@{
    id       = $r._id
    name     = [string]$r.carpark
    category = [string]$r.category
    w1       = [string]$r.weekdays_rate_1
    w2       = [string]$r.weekdays_rate_2
    sat      = [string]$r.saturday_rate
    sun      = [string]$r.sunday_publicholiday_rate
    lat      = $null
    lng      = $null
    address  = [string]$r.carpark
  }
}

function Mall-Json($m) {
  return ('{"id":"mall-' + $m.id + '","source":"mall","name":"' + (Escape-Json $m.name) +
    '","address":"' + (Escape-Json $m.address) + '","lat":' + (Json-NullOrNumber $m.lat) +
    ',"lng":' + (Json-NullOrNumber $m.lng) + ',"category":"' + (Escape-Json $m.category) +
    '","rates":{"weekdays1":"' + (Escape-Json $m.w1) +
    '","weekdays2":"' + (Escape-Json $m.w2) +
    '","saturday":"' + (Escape-Json $m.sat) +
    '","sundayPh":"' + (Escape-Json $m.sun) + '"}}')
}

$mallParts = New-Object System.Collections.Generic.List[string]
foreach ($m in $mallMeta) { $mallParts.Add((Mall-Json $m)) }
Write-Carparks $hdbParts $mallParts
Write-Host "Mall tariffs stored: $($mallParts.Count) (no coordinates in the LTA file; map pins are HDB)."
