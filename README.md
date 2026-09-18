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

The first YouTube proof-of-concept uses explicit browser tab audio capture rather than downloading or extracting YouTube media.

### Current proof-of-concept
- Paste a YouTube URL and open it in a new browser tab.
- Start the video in YouTube.
- Return to Ready Transpose.
- Choose the YouTube browser tab in the browser's capture picker and share its audio.
- Route the captured MediaStream through the same SoundTouchJS AudioWorklet used by local files.
- Change pitch from **-6 to +6 semitones in real time**.
- Stop capture from Ready Transpose or the browser's sharing controls.

The browser requires an explicit user gesture and permission for getDisplayMedia(). Browser support for captured audio varies, so the first validation target is **desktop Chrome**. The app should not download, cache, or extract YouTube media.

### YouTube capture manual test
1. Run the app over a secure context (localhost is suitable for local development).
2. Open the app in desktop Chrome.
3. Paste a YouTube URL and click **Open YouTube**.
4. Start the song in the YouTube tab.
5. Return to Ready Transpose and click **Capture YouTube tab audio**.
6. In the browser picker, select the YouTube tab and enable/share its audio.
7. Confirm the processed audio is audible through the app.
8. Change pitch to -1, -3, +2, and +5 while the YouTube video continues playing.
9. Confirm the original audio is not heard alongside the processed audio.
10. Stop capture and confirm the app returns to an idle state.
11. Start another capture and confirm it works without refreshing the page.

### Success criteria
- User-authorized YouTube tab audio reaches the Web Audio graph.
- SoundTouchJS can transpose the live captured audio.
- Pitch changes happen without restarting the YouTube tab.
- Original local tab audio is suppressed where the browser supports that capture control.
- Capture stops cleanly when the user ends browser sharing.
- Local file playback continues to work exactly as before.

The exact production YouTube architecture will be decided after this proof-of-concept is validated.

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
