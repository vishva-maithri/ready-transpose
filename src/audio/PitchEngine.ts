import { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import processorUrl from '@soundtouchjs/audio-worklet/processor?url'

export class PitchEngine {
  private context: AudioContext|null=null
  private source: AudioBufferSourceNode|null=null
  private captureSource: MediaStreamAudioSourceNode|null=null
  private captureStream: MediaStream|null=null
  private node: SoundTouchNode|null=null
  private gain: GainNode|null=null
  private buffer: AudioBuffer|null=null
  private startedAt=0
  private pausedAt=0
  private playing=false
  private capturing=false

  private async ensureAudioContext() {
    this.context ??= new AudioContext()
    if (this.context.state==='suspended') await this.context.resume()
    await SoundTouchNode.register(this.context, processorUrl)
  }

  async load(file: File) {
    await this.ensureAudioContext()

    const nextBuffer=await this.context!.decodeAudioData(await file.arrayBuffer())

    this.stop()
    this.buffer=nextBuffer
    this.pausedAt=0
  }

  async captureTabAudio(semitones:number) {
    await this.ensureAudioContext()

    this.stop()
    this.buffer=null
    this.pausedAt=0

    const audioConstraints: MediaTrackConstraints & Record<string, unknown> = {}
    const supported=navigator.mediaDevices.getSupportedConstraints() as Record<string, boolean>
    if(supported.suppressLocalAudioPlayback) audioConstraints.suppressLocalAudioPlayback=true

    const captureOptions: DisplayMediaStreamOptions & Record<string, unknown> = {
      video:true,
      audio:audioConstraints,
      selfBrowserSurface:'exclude',
      systemAudio:'exclude',
      surfaceSwitching:'include',
      monitorTypeSurfaces:'exclude'
    }

    const stream=await navigator.mediaDevices.getDisplayMedia(captureOptions)

    const audioTracks=stream.getAudioTracks()
    if(audioTracks.length===0){
      stream.getTracks().forEach(track=>track.stop())
      throw new Error('No audio track was shared. Select a YouTube browser tab and enable Share audio.')
    }

    const source=this.context!.createMediaStreamSource(stream)
    const node=new SoundTouchNode({context:this.context!})
    const gain=this.context!.createGain()

    source.connect(node)
    node.connect(gain)
    gain.connect(this.context!.destination)

    node.pitchSemitones.value=semitones
    node.playbackRate.value=1

    this.captureStream=stream
    this.captureSource=source
    this.node=node
    this.gain=gain
    this.capturing=true
    this.playing=true

    audioTracks.forEach(track=>{
      track.addEventListener('ended',()=>{
        if(this.captureStream!==stream) return
        this.capturing=false
        this.playing=false
        this.cleanupCapture()
      })
    })
  }

  play(semitones:number) {
    if(!this.context||!this.buffer||this.playing||this.capturing) return

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
      if(this.source!==source) return
      this.playing=false
      this.pausedAt=0
      this.cleanupSource()
    }

    source.start(0,offset)
    this.playing=true
  }

  pause() {
    if(!this.context||!this.source||!this.playing||this.capturing) return

    this.pausedAt=this.getCurrentTime()
    this.playing=false
    this.cleanupSource()
  }

  seek(position:number,semitones:number) {
    if(!this.context||!this.buffer||this.capturing) return

    const target=Math.min(Math.max(position,0),this.buffer.duration)
    const wasPlaying=this.playing

    if(wasPlaying) {
      this.playing=false
      this.source=null
      this.cleanupSource()
    }

    this.pausedAt=target

    if(wasPlaying) this.play(semitones)
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
    this.capturing=false
    this.cleanupSource()
    this.cleanupCapture()
  }

  isPlaying() {
    return this.playing
  }

  isCapturing() {
    return this.capturing
  }

  getCurrentTime() {
    if(!this.context||!this.buffer) return 0
    if(!this.playing) return this.pausedAt
    return Math.min(
      Math.max(this.context.currentTime-this.startedAt,0),
      this.buffer.duration
    )
  }

  getDuration() {
    return this.buffer?.duration??0
  }

  getAudioBuffer() {
    return this.buffer
  }

  private cleanupCapture() {
    this.captureStream?.getTracks().forEach(track=>track.stop())
    this.captureStream=null
    this.captureSource?.disconnect()
    this.captureSource=null
    this.node?.disconnect()
    this.node=null
    this.gain?.disconnect()
    this.gain=null
  }

  private cleanupSource() {
    try { this.source?.stop() } catch {}
    this.source?.disconnect()
    this.source=null
    this.node?.disconnect()
    this.node=null
    this.gain?.disconnect()
    this.gain=null
  }
}