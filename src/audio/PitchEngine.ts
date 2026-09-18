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
    this.stop()
    this.context ??= new AudioContext()
    if (this.context.state==='suspended') await this.context.resume()
    await SoundTouchNode.register(this.context, processorUrl)
    this.buffer=await this.context.decodeAudioData(await file.arrayBuffer())
    this.pausedAt=0
  }

  play(semitones:number) {
    if (!this.context||!this.buffer||this.playing) return

    this.source=this.context.createBufferSource()
    this.source.buffer=this.buffer
    this.node=new SoundTouchNode({context:this.context})
    this.gain=this.context.createGain()

    this.source.connect(this.node)
    this.node.connect(this.gain)
    this.gain.connect(this.context.destination)

    this.node.pitchSemitones.value=semitones
    this.node.playbackRate.value=1
    this.source.playbackRate.value=1

    const offset=Math.min(this.pausedAt,this.buffer.duration)
    this.startedAt=this.context.currentTime-offset
    this.source.onended=()=>{
      if (this.playing) {
        this.playing=false
        this.pausedAt=0
        this.cleanupSource()
      }
    }

    this.source.start(0,offset)
    this.playing=true
  }

  pause() {
    if (!this.context||!this.source||!this.playing) return

    this.pausedAt=Math.min(
      Math.max(this.context.currentTime-this.startedAt,0),
      this.buffer?.duration??0
    )
    this.playing=false
    this.cleanupSource()
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
    this.buffer=null
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
