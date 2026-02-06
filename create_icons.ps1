Add-Type -AssemblyName System.Drawing
$sizes = @(16, 48, 128)
$dir = "c:\Users\fisch\Documents\YT Summary Chrome Extension\icons"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir }
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Red)
  $path = Join-Path $dir "icon$s.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Created $path"
}
