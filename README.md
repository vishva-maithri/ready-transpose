# Ready Transpose

**Make any song singable.**

Ready Transpose is a browser-based karaoke tool for changing the musical key of a track while keeping its tempo unchanged.

## Build philosophy

This project is being built deliberately in small, testable steps.

Each step should:
1. Have one clear goal.
2. Be runnable locally.
3. Be manually testable before the next feature is added.
4. Keep the audio engine isolated from the UI.
5. Avoid committing to a YouTube architecture until the browser/audio constraints are proven.

## Step 1 — Audio engine proof

The first working prototype focuses only on audio that the user owns or is permitted to process.

### Current scope

- React + TypeScript + Vite
- Web Audio API
- SoundTouchJS AudioWorklet
- Local audio upload
- Playback
- Pitch transposition from **-6 to +6 semitones**
- Tempo remains at the original playback rate
- Pitch can be changed while playback is active

### Manual test

1. Start the app with `npm install` and `npm run dev`.
2. Upload a known MP3/WAV/M4A file.
3. Start playback.
4. Confirm the track plays normally at `0` semitones.
5. Change to `-1`, `-2`, and `-3` while playing.
6. Confirm the pitch changes without restarting the track.
7. Confirm the tempo does not change.
8. Try positive values such as `+1` and `+3`.
9. Test the same changes with headphones and speakers.

### Success criteria

Step 1 is complete when:
- Audio loads reliably.
- Playback starts reliably.
- Pitch changes are audible and musically correct.
- Tempo remains stable when pitch changes.
- Changing pitch does not restart playback.
- There are no obvious clicks, gaps, or runaway CPU usage during normal use.

## Step 2 — Player quality

After Step 1 is validated:

- Play/pause toggle
- Seek/progress bar
- Current time and duration
- Restart from the current position
- Smooth pitch transitions
- End-of-track handling
- Loading/error states — **complete**

## Step 3 — Audio analysis

Then add:

- BPM estimation — **complete**
- Musical key estimation
- Confidence score
- Display of detected key
- Display of the current key after transposition

## Step 4 — Party UX polish

Keep the experience intentionally simple: load a song, play it, change the pitch, and sing.

Current polish:

- Keyboard shortcut: **Space** for play/pause
- Keyboard shortcuts: **Left/Right arrows** for pitch changes
- Keyboard shortcut: **0** to reset pitch
- Larger, easier-to-tap semitone controls
- Clearer party-first hero copy

Future polish can include a fullscreen party mode and other lightweight presentation improvements, without adding setup or singer profiles.

## Step 5 — YouTube integration

YouTube will be handled only after the audio pipeline is proven.

The design must use permitted YouTube playback/API mechanisms. The app should not depend on secretly downloading or extracting copyrighted YouTube audio.

The exact architecture will be chosen after validating the current YouTube platform constraints and the desired user experience.

## Tech direction

**Frontend**
- React
- TypeScript
- Vite

**Audio**
- Web Audio API
- AudioWorklet
- SoundTouchJS initially

**Future backend**
- To be decided after the browser-only prototype is proven.

## Local development

```bash
npm install
npm run dev
```

Build verification:

```bash
npm run build
```

## Product principle

**Don't build the whole product until the core audio experience feels right.**
