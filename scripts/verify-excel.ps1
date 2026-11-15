param([string]$Only='')
$ErrorActionPreference = 'Stop'
$relative = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../tmp/latest-excel-qa.txt') -Raw
$root = Join-Path $PSScriptRoot "../$relative"
$root = (Resolve-Path -LiteralPath $root).Path
$layout = Get-Content -LiteralPath (Join-Path $root 'layout.json') -Raw | ConvertFrom-Json
$excel = $null
function Assert-Close($actual, $expected, $label) {
  if ([Math]::Abs([double]$actual-[double]$expected) -gt 0.000001) { throw "$label : actual=$actual expected=$expected" }
}
function Invoke-ExcelRetry([scriptblock]$action) { for ($attempt=0; $attempt -lt 12; $attempt++) { try { return (& $action) } catch { if (($_.Exception.HResult -notin @(-2147418111,-2146777998)) -or $attempt -eq 11) { throw }; Start-Sleep -Milliseconds 500 } } }
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  foreach ($name in @('single','two','mm1','dice','coin')) {
    if ($Only -and $name -ne $Only) { continue }
    $book = Invoke-ExcelRetry { $excel.Workbooks.Open((Join-Path $root "$name.xlsx")) }; Invoke-ExcelRetry { $excel.Calculation = -4135 }
    $sheet = Invoke-ExcelRetry { $book.Worksheets.Item(1) }
    if ($book.Worksheets.Count -ne 1) { throw "$name has extra sheets" }
    Invoke-ExcelRetry { $excel.CalculateFullRebuild() }
    if ($name -in @('single','two','mm1')) {
      $first = $layout.$name.first
      $last = $layout.$name.last
      $old = $sheet.Cells.Item($first,2).Value2
      Invoke-ExcelRetry { $excel.CalculateFullRebuild() }
      if ($old -eq $sheet.Cells.Item($first,2).Value2) { throw "$name RAND did not change" }
      foreach ($mode in @('shared','alternate','random','shortest')) {
        if ($name -eq 'two') {
          $sheet.Range('U3').Value2 = $(if ($mode -eq 'shared') {'shared'} else {'independent'})
          $sheet.Range('U4').Value2 = $mode
          Invoke-ExcelRetry { $excel.CalculateFullRebuild() }
        }
        $data = $sheet.Range("A${first}:R${last}").Value2
        $free = @(0.0,0.0); $at=0.0; $totalWait=0.0
        for ($i=1; $i -le ($last-$first+1); $i++) {
          $server = [int]$data[$i,6]-1
          $at += [double]$data[$i,3]
          Assert-Close $data[$i,4] $at "$name AT row $i"
          $start = [Math]::Max([double]$at,[double]$free[$server])
          Assert-Close $data[$i,8] $start "$name SS row $i"
          Assert-Close $data[$i,9] ($start+$data[$i,7]) "$name ES row $i"
          Assert-Close $data[$i,10] ($start-$at) "$name wait row $i"
          Assert-Close $data[$i,12] ([Math]::Max([double]0,[double]($start-$free[$server]))) "$name idle row $i"
          if ($name -eq 'two' -and $mode -eq 'alternate') { Assert-Close $data[$i,6] $(if($i%2 -eq 1){1}else{2}) 'alternate routing' }
          if ($name -eq 'two' -and $mode -eq 'random') { Assert-Close $data[$i,6] $(if($data[$i,17] -lt .5){1}else{2}) 'random routing' }
          if ($name -eq 'two' -and $mode -eq 'shortest') { Assert-Close $data[$i,6] $(if($free[0] -le $free[1]){1}else{2}) 'earliest routing' }
          if ($name -eq 'two' -and $mode -eq 'shared') { $expected=if($free[0] -le $at){1}elseif($free[1] -le $at){2}elseif($free[0] -le $free[1]){1}else{2}; Assert-Close $data[$i,6] $expected 'shared routing' }
          if ($name -eq 'mm1') { Assert-Close $data[$i,3] (-[Math]::Log(1-$data[$i,2])/2) 'exponential IAT'; Assert-Close $data[$i,7] (-[Math]::Log(1-$data[$i,5])/3) 'exponential ST' }
          $free[$server]=[double]$data[$i,9]; $totalWait += $data[$i,10]
        }
        Assert-Close $sheet.Range('U11').Value2 $totalWait 'total waiting time'
        if ($name -ne 'two') { break }
      }
      if ($name -eq 'single') {
        $sheet.Range('U2').Value2=1
        $sheet.Range('B6:B13').Value2=5
        $sheet.Range('G6:G11').Value2=2
        Invoke-ExcelRetry { $excel.CalculateFullRebuild() }
        Assert-Close $sheet.Cells.Item($first,3).Value2 0 'first arrival zero'
        Assert-Close $sheet.Cells.Item(($first+1),3).Value2 5 'edited IAT lookup'
        Assert-Close $sheet.Cells.Item(($first+1),7).Value2 2 'edited ST lookup'
        $sheet.Range('C6').Value2=.8
        Invoke-ExcelRetry { $excel.CalculateFullRebuild() }
        if ($sheet.Range('D14').Text -ne 'INVALID') { throw 'Invalid distribution not detected' }
      }
      if ($name -eq 'mm1') { $sheet.Range('U5').Value2=4; Invoke-ExcelRetry { $excel.CalculateFullRebuild() }; if($sheet.Range('U31').Value2 -ne 'No finite steady state'){throw 'Unstable model not labeled'} }
    } elseif ($name -eq 'dice') {
      $expectedFaces=@('000010000','100000001','100010001','101000101','101010101','101101101')
      for ($face=1; $face -le 6; $face++) {
        Invoke-ExcelRetry { $sheet.Range('B4').Value2=[double]$face }
        $sheet.Calculate()
        $pips=''
        for ($r=7;$r -le 9;$r++){for($c=2;$c -le 4;$c++){ $pips += $(if($sheet.Cells.Item($r,$c).Value2 -eq '●'){'1'}else{'0'}) }}
        if ($pips -ne $expectedFaces[$face-1]) { throw "Invalid dice face $face : $pips" }
      }
      Write-Output 'PASS dice: all six pip layouts'; $sheet.PageSetup.PrintArea='A1:J23'
      $sheet.ExportAsFixedFormat(0,(Join-Path $root 'dice-preview.pdf'))
    } else {
      $sheet.Range('B4').Value2=.4999; $sheet.Calculate()
      if ($sheet.Range('B6').Value2 -notlike 'Heads*'){throw 'Coin heads mapping failed'}
      $sheet.Range('B4').Value2=.5; $sheet.Calculate()
      if ($sheet.Range('B6').Value2 -notlike 'Tails*'){throw 'Coin tails boundary failed'}
      $sheet.PageSetup.PrintArea='A1:J16'
      $sheet.ExportAsFixedFormat(0,(Join-Path $root 'coin-preview.pdf'))
    }
    Write-Output "PASS $name : native Excel recalculation and formulas"
    Invoke-ExcelRetry { $book.Close($false) }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book)
  }
} catch { Write-Output $_.ToString(); throw } finally { if ($null -ne $excel) { try { Invoke-ExcelRetry { $excel.Quit() } } catch { Write-Warning "Excel cleanup: $($_.Exception.Message)" }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) } }






