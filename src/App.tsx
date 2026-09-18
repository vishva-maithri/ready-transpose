import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, Link2, Lightbulb, Maximize2, Minimize2, Music2, PartyPopper, Pause, Play, Radio, RotateCcw, Square, Upload, Youtube } from 'lucide-react'
import { PitchEngine } from './audio/PitchEngine'
import { detectKey, KeyName } from './audio/KeyDetector'
import { estimateBpm } from './audio/BpmDetector'

const SEMITONES=Array.from({length:13},(_,i)=>i-6)
const PITCH_CLASSES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']

const getTransposedKey=(key:KeyName,semitones:number)=>{
  const tonicIndex=PITCH_CLASSES.indexOf(key.tonic)
  if(tonicIndex<0) return key.label
  const nextTonic=PITCH_CLASSES[(tonicIndex+semitones+12)%12]
  return `${nextTonic} ${key.mode==='major'?'Major':'Minor'}`
}

const formatTime=(seconds:number)=>{
  if(!Number.isFinite(seconds)||seconds<0) return '0:00'
  const minutes=Math.floor(seconds/60)
  const remaining=Math.floor(seconds%60)
  return `${minutes}:${String(remaining).padStart(2,'0')}`
}

export default function App(){
  const [url,setUrl]=useState('')
  const [pitch,setPitch]=useState(0)
  const [trackName,setTrackName]=useState('')
  const [status,setStatus]=useState('Ready')
  const [playing,setPlaying]=useState(false)
  const [loading,setLoading]=useState(false)
  const [currentTime,setCurrentTime]=useState(0)
  const [duration,setDuration]=useState(0)
  const [detectedKey,setDetectedKey]=useState<KeyName|null>(null)
  const [bpm,setBpm]=useState(0)
  const [analysing,setAnalysing]=useState(false)
  const [partyMode,setPartyMode]=useState(false)
  const [liveCapture,setLiveCapture]=useState(false)
  const [pitchPulse,setPitchPulse]=useState(false)
  const pitchPulseTimer=useRef<number|undefined>(undefined)
  const seeking=useRef(false)
  const pendingSeek=useRef<number|null>(null)
  const engine=useRef(new PitchEngine())


  useEffect(()=>{
    const handleFullscreenChange=()=>setPartyMode(document.fullscreenElement!==null)
    document.addEventListener('fullscreenchange',handleFullscreenChange)
    return ()=>document.removeEventListener('fullscreenchange',handleFullscreenChange)
  },[])

  const togglePartyMode=async()=>{
    if(document.fullscreenElement){
      await document.exitFullscreen()
      setPartyMode(false)
      return
    }
    try{
      await document.documentElement.requestFullscreen()
      setPartyMode(true)
    }catch{
      setPartyMode(true)
    }
  }

  useEffect(()=>{
    const handleKeyDown=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement
      if(target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.isContentEditable)return

      if(event.code==='Space'){
        event.preventDefault()
        togglePlayback()
        return
      }

      if(event.key==='ArrowLeft'){
        event.preventDefault()
        if(trackName) {
          const target=Math.max(0,engine.current.getCurrentTime()-5)
          engine.current.seek(target,pitch)
          setCurrentTime(engine.current.getCurrentTime())
          setStatus(playing?'Playing':'Ready to play')
        }
        return
      }

      if(event.key==='ArrowRight'){
        event.preventDefault()
        if(trackName) {
          const target=Math.min(engine.current.getDuration(),engine.current.getCurrentTime()+5)
          engine.current.seek(target,pitch)
          setCurrentTime(engine.current.getCurrentTime())
          setStatus(playing?'Playing':'Ready to play')
        }
        return
      }

      if(event.key==='ArrowUp'){
        event.preventDefault()
        changePitch(Math.min(6,pitch+1))
        return
      }

      if(event.key==='ArrowDown'){
        event.preventDefault()
        changePitch(Math.max(-6,pitch-1))
        return
      }

      if(event.key==='0'){
        event.preventDefault()
        changePitch(0)
      }
    }

    window.addEventListener('keydown',handleKeyDown)
    return ()=>window.removeEventListener('keydown',handleKeyDown)
  },[pitch,playing,loading,trackName])

  useEffect(()=>{
    if(!playing) return
    const timer=window.setInterval(()=>{
      if(seeking.current) return

      const audioPlaying=engine.current.isPlaying()
      const audioTime=engine.current.getCurrentTime()
      const audioDuration=engine.current.getDuration()

      setDuration(audioDuration)

      if(!audioPlaying){
        const wasCapturing=engine.current.isCapturing()
        setCurrentTime(audioDuration)
        setPlaying(false)
        setLiveCapture(false)
        setStatus(wasCapturing?'Capture ended':'Finished')
        return
      }

      setCurrentTime(audioTime)
    },100)
    return ()=>window.clearInterval(timer)
  },[playing])

  const openYoutube=()=>{
    const value=url.trim()
    if(!value){
      setStatus('Paste a YouTube URL first')
      return
    }

    try{
      const youtubeUrl=new URL(value.startsWith('http')?value:`https://${value}`)
      const host=youtubeUrl.hostname.replace(/^www\./,'')
      if(host!=='youtube.com'&&!host.endsWith('.youtube.com')&&host!=='youtu.be'){
        setStatus('Please enter a YouTube URL')
        return
      }
      window.open(youtubeUrl.toString(),'_blank','noopener,noreferrer')
      setStatus('YouTube opened — start the song, then capture its tab')
    }catch{
      setStatus('Please enter a valid YouTube URL')
    }
  }

  const startCapture=async()=>{
    if(loading||liveCapture)return

    setLoading(true)
    setStatus('Choose your YouTube tab and share its audio…')
    setDetectedKey(null)
    setBpm(0)
    setAnalysing(false)

    try{
      await engine.current.captureTabAudio(pitch)
      setLiveCapture(true)
      setTrackName('YouTube tab audio')
      setCurrentTime(0)
      setDuration(0)
      setPlaying(true)
      setStatus('Live — YouTube tab audio')
    }catch(error){
      console.error(error)
      setStatus(error instanceof Error?error.message:'Could not capture browser audio')
      setLiveCapture(false)
      setPlaying(false)
    }finally{
      setLoading(false)
    }
  }

  const stopCapture=()=>{
    if(!liveCapture)return
    engine.current.stop()
    setLiveCapture(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setStatus('Capture stopped')
  }

  const loadFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]
    if(!file||loading)return

    setLoading(true)
    setLiveCapture(false)
    setStatus('Loading audio…')
    setDetectedKey(null)
    setBpm(0)
    setAnalysing(false)
    try{
      await engine.current.load(file)
      setTrackName(file.name)
      setPitch(0)
      setPlaying(false)
      setCurrentTime(0)
      setDuration(engine.current.getDuration())
      setAnalysing(true)
      setStatus('Analysing track…')
      window.setTimeout(()=>{
        try{
          const buffer=engine.current.getAudioBuffer()
          if(buffer){
            setDetectedKey(detectKey(buffer))
            setBpm(estimateBpm(buffer))
          }
        }catch(error){
          console.error(error)
        }finally{
          setAnalysing(false)
          setStatus('Ready to play')
        }
      },0)
    }catch(error){
      console.error(error)
      setStatus('Could not load this audio file')
      e.target.value=''
    }finally{
      setLoading(false)
    }
  }

  const togglePlayback=()=>{
    if(loading)return

    if(liveCapture){
      stopCapture()
      return
    }

    if(!trackName){
      setStatus('Upload an audio file for the first working prototype')
      return
    }

    if(playing){
      engine.current.pause()
      setCurrentTime(engine.current.getCurrentTime())
      setPlaying(false)
      setStatus('Paused')
    }else{
      engine.current.play(pitch)
      setDuration(engine.current.getDuration())
      setCurrentTime(engine.current.getCurrentTime())
      setPlaying(true)
      setStatus('Playing')
    }
  }

  const restart=()=>{
    if(!trackName) return
    const wasPlaying=playing
    engine.current.seek(0,pitch)
    setCurrentTime(0)
    setStatus(wasPlaying?'Playing':'Ready to play')
  }

  const beginSeek=()=>{
    if(loading)return
    seeking.current=true
    pendingSeek.current=null
  }

  const previewSeek=(value:number)=>{
    if(loading)return
    setCurrentTime(value)
    pendingSeek.current=value
  }

  const finishSeek=(value:number)=>{
    if(loading)return
    const target=pendingSeek.current ?? value
    pendingSeek.current=null
    seeking.current=false
    engine.current.seek(target,pitch)
    setCurrentTime(engine.current.getCurrentTime())
  }

  const changePitch=(value:number)=>{
    if(loading) return
    setPitch(value)
    setPitchPulse(false)
    if(pitchPulseTimer.current) window.clearTimeout(pitchPulseTimer.current)
    window.requestAnimationFrame(()=>setPitchPulse(true))
    pitchPulseTimer.current=window.setTimeout(()=>setPitchPulse(false),180)
    if(playing) engine.current.setPitch(value)
  }

  const nudgePitch=(delta:number)=>changePitch(Math.min(6,Math.max(-6,pitch+delta)))


  if(partyMode) return <main className="party-mode">
    <div className="party-topbar">
      <div className="brand"><div className="brand-mark"><Music2 size={22}/></div><span>Ready<span className="accent">Transpose</span></span></div>
      <button className="party-exit" onClick={togglePartyMode} aria-label="Exit Party Mode"><Minimize2 size={20}/><span>Exit</span></button>
    </div>
    <div className="party-content">
      <span className="party-eyebrow">KARAOKE • PARTY MODE</span>
      <div className="party-art"><Music2 size={54}/></div>
      <h1>{trackName||'No track loaded'}</h1>
      <div className="party-status"><span className={"status-dot"+(playing?" party-playing":"")}/>{status}</div>
      <div className="party-progress">
        <input className="progress-slider" type="range" min="0" max={duration||0} step="0.1" value={Math.min(currentTime,duration||0)} onPointerDown={beginSeek} onChange={e=>previewSeek(Number(e.target.value))} onPointerUp={e=>finishSeek(Number(e.currentTarget.value))} disabled={loading||!duration} aria-label="Playback position"/>
        <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="party-controls">
        <button className="party-restart" onClick={restart} disabled={loading||!trackName} aria-label="Restart"><RotateCcw size={24}/></button>
        <button className="party-play" onClick={togglePlayback} disabled={loading} aria-label={playing?'Pause':'Play'}>{playing?<Pause fill="currentColor" size={34}/>:<Play fill="currentColor" size={34}/>}</button>
      </div>
      <div className="party-pitch">
        <button onClick={()=>nudgePitch(-1)} disabled={loading} aria-label="Lower pitch">−</button>
        <div><span className="label">TRANSPOSE</span><strong>{pitch>0?'+':''}{pitch}</strong><span>semitones</span></div>
        <button onClick={()=>nudgePitch(1)} disabled={loading} aria-label="Raise pitch">+</button>
      </div>
      <div className="party-analysis">
        <div><span className="label">CURRENT KEY</span><strong>{detectedKey?getTransposedKey(detectedKey,pitch):'—'}</strong></div>
        <div><span className="label">ORIGINAL KEY</span><strong>{detectedKey?.label||'—'}</strong></div>
        <div><span className="label">TEMPO</span><strong>{bpm>0?bpm+' BPM':'—'}</strong></div>
      </div>
      <p className="party-hint">← → seek 5 sec&nbsp;&nbsp; • &nbsp;&nbsp;↑ ↓ transpose&nbsp;&nbsp; • &nbsp;&nbsp;Space play/pause&nbsp;&nbsp; • &nbsp;&nbsp;0 reset</p>
    </div>
  </main>

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Music2 size={19}/></div><span>Ready<span className="accent">Transpose</span></span></div><span className="prototype">PROTOTYPE</span></header>
    <section className="hero"><p className="eyebrow">KARAOKE • REAL-TIME PITCH SHIFTING</p><h1>Make any song<br/><span>singable.</span></h1><p className="hero-copy">Load a song, change the pitch, and sing along without changing the tempo.</p></section>
    <section className="input-card">
      <div className="input-heading"><div><p className="label">YOUTUBE TRACK</p><h2>Bring your song</h2></div><Youtube size={28}/></div>
      <div className="url-row"><Link2 size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" aria-label="YouTube URL" disabled={loading}/><button className="primary-button" disabled={loading} onClick={openYoutube}><ExternalLink size={16}/>Open YouTube</button></div>
      <div className="capture-hint"><Radio size={15}/><span>Open the video in YouTube, start playback, then capture its browser tab below.</span></div>
      <button className={`capture-button${liveCapture?" is-live":""}`} disabled={loading&&!liveCapture} onClick={liveCapture?stopCapture:startCapture}>{liveCapture?<><Square size={15} fill="currentColor"/>Stop capture</>:<><Radio size={16}/>Capture YouTube tab audio</>}</button>
      <div className="divider"><span>OR</span></div>
      <label className={`upload-zone${loading?" is-loading":""}`}><Upload size={22}/><strong>{loading?"Loading audio…":"Upload an audio file"}</strong><span>{loading?"Please wait while the track is decoded":"MP3, WAV, M4A — used for the working audio prototype"}</span><input type="file" accept="audio/*" onChange={loadFile} disabled={loading}/></label>
    </section>
    <section className="player-card">
      <div className="track-row"><div className="track-art"><Music2/></div><div className="track-info"><span className={`status status-${loading?"loading":playing?"playing":status==="Finished"?"finished":status==="Paused"?"paused":"ready"}`}><span className="status-dot"/>{status}</span><strong>{trackName||'No track loaded'}</strong></div><div className="player-actions"><button className="party-mode-button" onClick={togglePartyMode} disabled={loading||!trackName} aria-label="Enter Party Mode">
  <span className="party-sparkle party-sparkle-one">✦</span><span className="party-sparkle party-sparkle-two">✦</span>
  <span className="party-icon"><PartyPopper size={18}/></span>
  <span className="party-copy"><strong>Party Mode</strong><small>GO FULLSCREEN</small></span>
  <Maximize2 size={17}/>
</button><button className="secondary-play-button" onClick={restart} disabled={loading||!trackName||liveCapture} aria-label="Restart">{<RotateCcw size={18}/>}</button><button className="play-button" onClick={togglePlayback} disabled={loading} aria-label={playing?'Pause':'Play'}>{playing?<Pause fill="currentColor" size={21}/>:<Play fill="currentColor" size={21}/>}</button></div></div>
      <div className="progress-panel">
        <input className="progress-slider" type="range" min="0" max={duration||0} step="0.1" value={Math.min(currentTime,duration||0)} onPointerDown={beginSeek} onChange={e=>previewSeek(Number(e.target.value))} onPointerUp={e=>finishSeek(Number(e.currentTarget.value))} onKeyDown={e=>{if(e.key==='Enter') finishSeek(Number(e.currentTarget.value))}} disabled={loading||!duration} aria-label="Playback position"/>
        <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="pitch-panel"><div className="pitch-heading"><div><span className="label">TRANSPOSE</span><div className={`pitch-value${pitchPulse?' is-changing':''}`}>{pitch>0?'+':''}{pitch}<small> semitones</small></div><span className="keyboard-hint">↑ ↓ to transpose</span></div><div className="pitch-actions"><button className="pitch-nudge" onClick={()=>nudgePitch(-1)} disabled={loading||pitch<=-6} aria-label="Lower pitch">−</button><button className="reset" onClick={()=>changePitch(0)} disabled={loading||pitch===0}>Reset</button><button className="pitch-nudge" onClick={()=>nudgePitch(1)} disabled={loading||pitch>=6} aria-label="Raise pitch">+</button></div></div>
      <input className="pitch-slider" type="range" min="-6" max="6" step="1" value={pitch} onChange={e=>changePitch(Number(e.target.value))} disabled={loading} aria-label="Transpose pitch"/>
      <div className="semitone-grid">{SEMITONES.map(step=><button key={step} className={step===pitch?'active':''} onClick={()=>changePitch(step)} disabled={loading}>{step>0?'+':''}{step}</button>)}</div></div>
      <div className={`key-analysis${analysing?" is-analysing":""}`}>{liveCapture ? <div className="key-analysis-live"><span className="key-icon"><Radio size={24}/></span><div><span className="label">LIVE AUDIO CAPTURE</span><strong>YouTube tab connected</strong><p>Pitch shifting is running in real time. Use the transpose controls above.</p></div></div> : analysing ? <div className="key-analysis-loading"><span className="key-icon">🎼</span><div><strong>Analysing track…</strong><p>Detecting the song’s key and tempo.</p></div></div> : detectedKey ? <><div className="key-column"><span className="key-icon">🎼</span><div><span className="label">DETECTED KEY</span><strong className="key-name">{detectedKey.label}</strong><span className="key-confidence">{detectedKey.confidence}% confidence</span>{bpm>0&&<span className={`tempo-value${playing?" is-playing":""}`} style={{animationDuration:`${60/bpm}s`}}>♩ {bpm} BPM</span>}</div></div><div className="key-arrow"><ArrowRight size={24}/></div><div className="key-column current-key"><div><span className="label">WITH CURRENT TRANSPOSE</span><strong className="key-name">{getTransposedKey(detectedKey,pitch)}</strong><span className="key-subtitle">{pitch===0?"Same as the original key":`${pitch>0?"+":""}${pitch} semitones from original`}</span></div></div><div className="key-tip"><Lightbulb size={19}/><div><strong>A better starting point</strong><p>Use the detected key as your reference, then move a few semitones up or down until it feels comfortable.</p></div></div></> : <div className="key-analysis-empty"><span className="key-icon">🎼</span><div><strong>Automatic key analysis</strong><p>Upload a track and we’ll detect its musical key.</p></div></div>}</div>
    </section>
    <footer><span>Ready Transpose</span><span>Built for singers</span></footer>
  </main>
}