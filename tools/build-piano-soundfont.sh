#!/usr/bin/env bash
# Rebuilds public/soundfonts/acoustic_grand_piano-mp3.js from the Salamander Grand Piano
# (Alexander Holm, CC BY 3.0, https://github.com/sfzinstruments/SalamanderGrandPiano).
#
#   tools/build-piano-soundfont.sh <path-to-salamander-checkout> [out.js]
#
# Offline: it downloads nothing. The checkout only needs Samples/*v10.flac (the mid velocity
# layer; soundfont-player has one sample per key and scales gain itself). Salamander samples
# every minor third (A, C, D#, F#), so each of the 88 keys takes the nearest sample and is
# resampled up or down one semitone. Needs ffmpeg with libmp3lame.
set -euo pipefail

SRC="${1:?usage: $0 <salamander-checkout> [out.js]}"
OUT="${2:-$(dirname "$0")/../public/soundfonts/acoustic_grand_piano-mp3.js}"
MAX_BYTES=$((4 * 1024 * 1024))
GAIN_DB="${GAIN_DB:--10}"  # level-matched to the FluidR3 choir and organ it plays alongside

command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
[ -d "$SRC/Samples" ] || { echo "$SRC/Samples not found" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FLATS=(C Db D Eb E F Gb G Ab A Bb B)   # key names exactly as MIDI.js / the old FluidR3 file
SHARPS=(C C# D D# E F F# G G# A A# B)  # Salamander file names

{
  echo "// Salamander Grand Piano by Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)."
  echo "// Source: https://github.com/sfzinstruments/SalamanderGrandPiano, v10 velocity layer, resampled to 88 keys"
  echo "// and encoded as 64 kbps mono mp3 by tools/build-piano-soundfont.sh."
  echo "if (typeof(MIDI) === 'undefined') var MIDI = {};"
  echo "if (typeof(MIDI.Soundfont) === 'undefined') MIDI.Soundfont = {};"
  echo "MIDI.Soundfont.acoustic_grand_piano = {"
} > "$TMP/out.js"

for midi in $(seq 21 108); do
  pc=$((midi % 12)); oct=$((midi / 12 - 1))
  name="${FLATS[$pc]}$oct"
  # nearest sampled pitch class (A=9, C=0, D#=3, F#=6) within one semitone
  case $pc in
    9|0|3|6) shift=0 ;;
    10|1|4|7) shift=1 ;;
    8|11|2|5) shift=-1 ;;
  esac
  src=$((midi - shift))
  sname="${SHARPS[$((src % 12))]}$((src / 12 - 1))v10.flac"
  [ -f "$SRC/Samples/$sname" ] || { echo "missing $SRC/Samples/$sname" >&2; exit 1; }
  # bass rings longer; treble decays fast anyway
  if [ "$midi" -le 72 ]; then len=3; else len=2; fi
  fade_start=$(awk "BEGIN{print $len-0.3}")
  rate=$(awk "BEGIN{printf \"%.0f\", 48000*2^($shift/12)}")
  ffmpeg -nostdin -loglevel error -y -i "$SRC/Samples/$sname" \
    -af "asetrate=$rate,aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,volume=${GAIN_DB}dB,atrim=0:$len,afade=t=out:st=$fade_start:d=0.3" \
    -ar 44100 -ac 1 -map_metadata -1 -id3v2_version 0 -write_id3v1 0 -c:a libmp3lame -b:a 64k "$TMP/$name.mp3"
  printf '"%s": "data:audio/mp3;base64,%s",\n' "$name" "$(base64 -w0 "$TMP/$name.mp3")" >> "$TMP/out.js"
done

echo "}" >> "$TMP/out.js"

size=$(stat -c %s "$TMP/out.js")
if [ "$size" -gt "$MAX_BYTES" ]; then
  echo "output is $size bytes, over the $MAX_BYTES limit" >&2
  exit 1
fi
mv "$TMP/out.js" "$OUT"
echo "wrote $OUT ($size bytes)"
