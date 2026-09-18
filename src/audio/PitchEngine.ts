import { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import processorUrl from '@soundtouchjs/audio-worklet/processor?url'

export class PitchEngine {
  private context: AudioContext|null=null
  private source: AudioBufferSourceNode|null=null
  private node: SoundTouchNode|null=null
  private gain: GainNode|null=null
  private buffer: AudioBuffer|null=null

  async load(file: File) {
    this.stop()
    this.context ??= new AudioContext()
    if (this.context.state==='suspended') await this.context.resume()
    await SoundTouchNode.register(this.context, processorUrl)
    this.buffer=await this.context.decodeAudioData(await file.arrayBuffer())
  }

  play(semitones:number) {
    if (!this.context||!this.buffer) return
    this.stopSourceOnly()
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
    this.source.start()
  }

  setPitch(semitones:number) {
    this.node?.pitchSemitones.setTargetAtTime(semitones,this.context?.currentTime??0,0.015)
  }

  pause(){ this.stopSourceOnly() }
  stop(){ this.stopSourceOnly(); this.buffer=null }

  private stopSourceOnly() {
    try { this.source?.stop() } catch {}
    this.source?.disconnect(); this.node?.disconnect(); this.gain?.disconnect()
    this.source=null; this.node=null; this.gain=null
  }
}