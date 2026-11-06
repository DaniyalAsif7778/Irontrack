$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ffmpeg = (Get-Command ffmpeg).Source
$ffprobe = (Get-Command ffprobe).Source
$paragraphs = (Get-Content -LiteralPath (Join-Path $root 'narration.txt') -Raw) -split '\r?\n\s*\r?\n' | Where-Object { $_.Trim() }
$sceneNames = @('irontrack-main', 'irontrack-routine', 'irontrack-workout', 'irontrack-progress')
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -eq 'Microsoft Mark' } | Select-Object -First 1
if (-not $voice) { $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1 }
if (-not $voice) { throw 'An English Windows speech voice is required to render narration.' }
$synth.SelectVoice($voice.VoiceInfo.Name)
$synth.Rate = -1
$synth.Volume = 100

$segments = @()
$manifest = Join-Path $root 'audio-concat.txt'
try {
  for ($i = 0; $i -lt 4; $i++) {
    $wav = Join-Path $root ("narration-{0}.wav" -f ($i + 1))
    $synth.SetOutputToWaveFile($wav)
    $synth.Speak($paragraphs[$i].Trim())
    $synth.SetOutputToNull()
    $durationText = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $wav
    $duration = [double]::Parse($durationText.Trim(), [Globalization.CultureInfo]::InvariantCulture)
    $segments += [pscustomobject]@{ wav = $wav; duration = $duration; text = $paragraphs[$i].Trim() }
  }

  $lines = foreach ($segment in $segments) { "file '$($segment.wav)'" }
  Set-Content -LiteralPath $manifest -Value $lines -Encoding utf8
  $audioPath = Join-Path $root 'irontrack-demo.wav'
  & $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $manifest -c:a pcm_s16le $audioPath

  $clock = 0.0
  $srt = [System.Collections.Generic.List[string]]::new()
  $filter = [System.Collections.Generic.List[string]]::new()
  for ($i = 0; $i -lt 4; $i++) {
    $segment = $segments[$i]
    $hold = 0.55
    $clip = $segment.duration + $hold
    $start = [TimeSpan]::FromSeconds($clock + 0.15).ToString('hh\:mm\:ss\,fff')
    $end = [TimeSpan]::FromSeconds($clock + $segment.duration).ToString('hh\:mm\:ss\,fff')
    $srt.Add(($i + 1).ToString())
    $srt.Add("$start --> $end")
    $srt.Add($segment.text)
    $srt.Add('')
    $filter.Add("[$i`:v]scale=1920:1080,fps=30,trim=duration=$([Math]::Round($clip, 3)),setpts=PTS-STARTPTS[v$i]")
    $clock += $clip
  }
  $filter.Add('[v0][v1][v2][v3]concat=n=4:v=1:a=0[vout]')
  $filter.Add('[4:a]apad=pad_dur=2.2[aout]')
  $filterPath = Join-Path $root 'video-filter.txt'
  $srtPath = Join-Path $root 'irontrack-demo.srt'
  Set-Content -LiteralPath $filterPath -Value $filter -Encoding utf8
  Set-Content -LiteralPath $srtPath -Value $srt -Encoding utf8
  $filterGraph = ($filter -join ';')

  $imageArgs = @()
  foreach ($name in $sceneNames) { $imageArgs += @('-loop', '1', '-framerate', '30', '-i', (Join-Path $root "$name.png")) }
  $videoPath = Join-Path $root 'irontrack-demo.mp4'
  & $ffmpeg -y -hide_banner -loglevel error @imageArgs -i $audioPath -i $srtPath -filter_complex $filterGraph -map '[vout]' -map '[aout]' -map 5:s:0 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -c:s mov_text -shortest -movflags +faststart $videoPath
  if ($LASTEXITCODE -ne 0) { throw 'FFmpeg could not create the demo video.' }
  Write-Output "Voice: $($voice.VoiceInfo.Name)"
  Write-Output ("Duration: {0:N1} seconds" -f $clock)
  Write-Output "Video: $videoPath"
  Write-Output "Audio: $audioPath"
} finally {
  $synth.Dispose()
  Remove-Item -LiteralPath $manifest,(Join-Path $root 'video-filter.txt') -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath $root -Filter 'narration-*.wav' | Remove-Item -Force
}
