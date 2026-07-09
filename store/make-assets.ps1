# Builds Chrome Web Store graphic assets from the raw screenshots in img/.
# Output: store/assets/  (1280x800 screenshots + 440x280 tile + 1400x560 marquee)
# Run:    powershell -ExecutionPolicy Bypass -File store\make-assets.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$img = Join-Path $root "img"
$out = Join-Path $PSScriptRoot "assets"
New-Item -ItemType Directory -Force $out | Out-Null

$bgColor = [System.Drawing.Color]::FromArgb(255, 11, 17, 32)     # #0b1120
$bgTop = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)       # #0f172a
$bgBottom = [System.Drawing.Color]::FromArgb(255, 30, 41, 59)    # #1e293b
$teal = [System.Drawing.Color]::FromArgb(255, 56, 189, 248)      # #38bdf8
$violet = [System.Drawing.Color]::FromArgb(255, 167, 139, 250)   # #a78bfa
$dim = [System.Drawing.Color]::FromArgb(255, 148, 163, 184)      # #94a3b8

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.InterpolationMode = "HighQualityBicubic"
  $g.PixelOffsetMode = "HighQuality"
  $g.TextRenderingHint = "AntiAliasGridFit"
  return @($bmp, $g)
}

# ---- Screenshot letterboxing: scale to fit inside 1280x800, centered on dark bg.
function Convert-Screenshot([string]$srcPath, [string]$dstPath, [double]$maxScale) {
  $src = [System.Drawing.Image]::FromFile($srcPath)
  $c = New-Canvas 1280 800
  $bmp = $c[0]; $g = $c[1]
  $g.Clear($bgColor)
  $scale = [Math]::Min([Math]::Min(1280.0 / $src.Width, 800.0 / $src.Height), $maxScale)
  $w = [int]($src.Width * $scale)
  $h = [int]($src.Height * $scale)
  $x = [int]((1280 - $w) / 2)
  $y = [int]((800 - $h) / 2)
  $g.DrawImage($src, $x, $y, $w, $h)
  $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
  Write-Output ("{0}  ({1}x{2} @ scale {3:N2})" -f (Split-Path -Leaf $dstPath), $w, $h, $scale)
}

# The visualizer shot leads the listing; the popup shot follows.
Convert-Screenshot (Join-Path $img "WebCode Sonification_2.png") (Join-Path $out "screenshot-1-visualizer-1280x800.png") 1.0
Convert-Screenshot (Join-Path $img "WebCode Sonification_1.png") (Join-Path $out "screenshot-2-popup-1280x800.png") 1.35

# ---- Waveform bars (the brand mark, same heights as the icon generator).
function Draw-Bars($g, [double]$cx, [double]$cy, [double]$unit) {
  $heights = @(0.32, 0.62, 0.92, 0.5, 0.74)
  $barW = 1.4 * $unit
  $gap = 0.9 * $unit
  $totalW = $heights.Count * $barW + ($heights.Count - 1) * $gap
  $x = $cx - $totalW / 2
  for ($i = 0; $i -lt $heights.Count; $i++) {
    $t = $i / [double]($heights.Count - 1)
    $r = [int]($teal.R + ($violet.R - $teal.R) * $t)
    $gg = [int]($teal.G + ($violet.G - $teal.G) * $t)
    $b = [int]($teal.B + ($violet.B - $teal.B) * $t)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, $r, $gg, $b))
    $h = $heights[$i] * 10 * $unit
    $rect = New-Object System.Drawing.RectangleF($x, ($cy - $h / 2), $barW, $h)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    $x += $barW + $gap
  }
}

function Draw-CenteredText($g, [string]$text, [string]$fontName, [double]$size, [System.Drawing.FontStyle]$style, [System.Drawing.Color]$color, [double]$cx, [double]$cy) {
  $font = New-Object System.Drawing.Font($fontName, $size, $style)
  $brush = New-Object System.Drawing.SolidBrush($color)
  $sz = $g.MeasureString($text, $font)
  $g.DrawString($text, $font, $brush, [float]($cx - $sz.Width / 2), [float]($cy - $sz.Height / 2))
  $brush.Dispose(); $font.Dispose()
}

# ---- Promo tile / marquee: gradient bg + bars + wordmark + tagline.
function New-Promo([int]$w, [int]$h, [string]$dstPath, [string]$title, [double]$titleSize, [string]$tag, [double]$tagSize) {
  $c = New-Canvas $w $h
  $bmp = $c[0]; $g = $c[1]
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bgTop, $bgBottom, 90.0)
  $g.FillRectangle($grad, $rect)
  $grad.Dispose()
  Draw-Bars $g ($w / 2) ($h * 0.34) ($h / 100.0)
  Draw-CenteredText $g $title "Segoe UI" $titleSize ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::FromArgb(255, 226, 232, 240)) ($w / 2) ($h * 0.62)
  Draw-CenteredText $g $tag "Segoe UI" $tagSize ([System.Drawing.FontStyle]::Regular) $dim ($w / 2) ($h * 0.78)
  $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output (Split-Path -Leaf $dstPath)
}

New-Promo 440 280 (Join-Path $out "promo-tile-440x280.png") "WebCode Sonification" 21 "The web was never silent." 11
New-Promo 1400 560 (Join-Path $out "marquee-1400x560.png") "WebCode Sonification Engine" 42 "Every webpage already has a structure. We let you hear it." 20

Write-Output "store assets written to $out"
