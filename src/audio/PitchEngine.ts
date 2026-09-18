import { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import processorUrl from '@soundtouchjs/audio-worklet/processor?url'

export class PitchEngine {
  private context: AudioContext|null=null
  private source: AudioBufferSourceNode|null=null
  private node: SoundTouchNode|null=null
  private gain: GainNode|null=null
  private buffer: AudioBuffer|null=null
  private startedAt=0
  private pausedAt=0
  private playing=false

  async load(file: File) {
    this.context ??= new AudioContext()
    if (this.context.state==='suspended') await this.context.resume()
    await SoundTouchNode.register(this.context, processorUrl)

    // Decode first so a bad file does not destroy the currently loaded track.
    const nextBuffer=await this.context.decodeAudioData(await file.arrayBuffer())

    this.stop()
    this.buffer=nextBuffer
    this.pausedAt=0
  }

  play(semitones:number) {
    if (!this.context||!this.buffer||this.playing) return

    const source=this.context.createBufferSource()
    source.buffer=this.buffer
    const node=new SoundTouchNode({context:this.context})
    const gain=this.context.createGain()

    source.connect(node)
    node.connect(gain)
    gain.connect(this.context.destination)

    node.pitchSemitones.value=semitones
    node.playbackRate.value=1
    source.playbackRate.value=1

    this.source=source
    this.node=node
    this.gain=gain

    const offset=Math.min(this.pausedAt,this.buffer.duration)
    this.startedAt=this.context.currentTime-offset

    source.onended=()=>{
      // Ignore an old source that was intentionally replaced, for example by seek.
      if (this.source!==source) return

      this.playing=false
      this.pausedAt=0
      this.cleanupSource()
    }

    source.start(0,offset)
    this.playing=true
  }

  pause() {
    if (!this.context||!this.source||!this.playing) return

    this.pausedAt=this.getCurrentTime()
    this.playing=false
    this.cleanupSource()
  }

  seek(position:number,semitones:number) {
    if (!this.context||!this.buffer) return

    const target=Math.min(Math.max(position,0),this.buffer.duration)
    const wasPlaying=this.playing

    if (wasPlaying) {
      // Mark the current source as inactive before stopping it so its onended
      // callback cannot affect the replacement source.
      this.playing=false
      this.source=null
      this.cleanupSource()
    }

    this.pausedAt=target

    if (wasPlaying) {
      this.play(semitones)
    }
  }

  setPitch(semitones:number) {
    this.node?.pitchSemitones.setTargetAtTime(
      semitones,
      this.context?.currentTime??0,
      0.015
    )
  }

  stop() {
    this.playing=false
    this.pausedAt=0
    this.cleanupSource()
  }

  isPlaying() {
    return this.playing
  }

  getCurrentTime() {
    if (!this.context||!this.buffer) return 0
    if (!this.playing) return this.pausedAt
    return Math.min(
      Math.max(this.context.currentTime-this.startedAt,0),
      this.buffer.duration
    )
  }

  getDuration() {
    return this.buffer?.duration??0
  }

  private cleanupSource() {
    try { this.source?.stop() } catch {}
    this.source?.disconnect()
    this.node?.disconnect()
    this.gain?.disconnect()
    this.source=null
    this.node=null
    this.gain=null
  }
}
