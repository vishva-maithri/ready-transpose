import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { ArrowRight, Link2, Lightbulb, Music2, Pause, Play, RotateCcw, Upload, Youtube } from 'lucide-react'
import { PitchEngine } from './audio/PitchEngine'
import { detectKey, KeyName } from './audio/KeyDetector'

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
  const [analysing,setAnalysing]=useState(false)
  const seeking=useRef(false)
  const pendingSeek=useRef<number|null>(null)
  const engine=useRef(new PitchEngine())

  useEffect(()=>{
    if(!playing) return
    const timer=window.setInterval(()=>{
      if(seeking.current) return

      const audioPlaying=engine.current.isPlaying()
      const audioTime=engine.current.getCurrentTime()
      const audioDuration=engine.current.getDuration()

      setDuration(audioDuration)

      if(!audioPlaying){
        setCurrentTime(audioDuration)
        setPlaying(false)
        setStatus('Finished')
        return
      }

      setCurrentTime(audioTime)
    },100)
    return ()=>window.clearInterval(timer)
  },[playing])

  const loadFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]
    if(!file||loading)return

    setLoading(true)
    setStatus('Loading audio…')
    setDetectedKey(null)
    setAnalysing(false)
    try{
      await engine.current.load(file)
      setTrackName(file.name)
      setPitch(0)
      setPlaying(false)
      setCurrentTime(0)
      setDuration(engine.current.getDuration())
      setAnalysing(true)
      setStatus('Analysing key…')
      window.setTimeout(()=>{
        try{
          const buffer=engine.current.getAudioBuffer()
          if(buffer) setDetectedKey(detectKey(buffer))
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

  const changePitch=(value:number)=>{setPitch(value);if(playing&&!loading)engine.current.setPitch(value)}

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Music2 size={19}/></div><span>Ready<span className="accent">Transpose</span></span></div><span className="prototype">PROTOTYPE</span></header>
    <section className="hero"><p className="eyebrow">KARAOKE • REAL-TIME PITCH SHIFTING</p><h1>Make any song<br/><span>singable.</span></h1><p className="hero-copy">Paste a karaoke track, find the right key, and transpose it up or down without changing the tempo.</p></section>
    <section className="input-card">
      <div className="input-heading"><div><p className="label">YOUTUBE TRACK</p><h2>Bring your song</h2></div><Youtube size={28}/></div>
      <div className="url-row"><Link2 size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" aria-label="YouTube URL" disabled={loading}/><button className="primary-button" disabled={loading} onClick={()=>setStatus('YouTube ingestion is the next integration step')}>Load track</button></div>
      <div className="divider"><span>OR</span></div>
      <label className={`upload-zone${loading?" is-loading":""}`}><Upload size={22}/><strong>{loading?"Loading audio…":"Upload an audio file"}</strong><span>{loading?"Please wait while the track is decoded":"MP3, WAV, M4A — used for the working audio prototype"}</span><input type="file" accept="audio/*" onChange={loadFile} disabled={loading}/></label>
    </section>
    <section className="player-card">
      <div className="track-row"><div className="track-art"><Music2/></div><div className="track-info"><span className={`status status-${loading?"loading":playing?"playing":status==="Finished"?"finished":status==="Paused"?"paused":"ready"}`}><span className="status-dot"/>{status}</span><strong>{trackName||'No track loaded'}</strong></div><div className="player-actions"><button className="secondary-play-button" onClick={restart} disabled={loading||!trackName} aria-label="Restart">{<RotateCcw size={18}/>}</button><button className="play-button" onClick={togglePlayback} disabled={loading} aria-label={playing?'Pause':'Play'}>{playing?<Pause fill="currentColor" size={21}/>:<Play fill="currentColor" size={21}/>}</button></div></div>
      <div className="progress-panel">
        <input className="progress-slider" type="range" min="0" max={duration||0} step="0.1" value={Math.min(currentTime,duration||0)} onPointerDown={beginSeek} onChange={e=>previewSeek(Number(e.target.value))} onPointerUp={e=>finishSeek(Number(e.currentTarget.value))} onKeyDown={e=>{if(e.key==='Enter') finishSeek(Number(e.currentTarget.value))}} disabled={loading||!duration} aria-label="Playback position"/>
        <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="pitch-panel"><div className="pitch-heading"><div><span className="label">TRANSPOSE</span><div className="pitch-value">{pitch>0?'+':''}{pitch}<small> semitones</small></div></div><button className="reset" onClick={()=>changePitch(0)} disabled={loading}>Reset</button></div>
      <input className="pitch-slider" type="range" min="-6" max="6" step="1" value={pitch} onChange={e=>changePitch(Number(e.target.value))} disabled={loading} aria-label="Transpose pitch"/>
      <div className="semitone-grid">{SEMITONES.map(step=><button key={step} className={step===pitch?'active':''} onClick={()=>changePitch(step)} disabled={loading}>{step>0?'+':''}{step}</button>)}</div></div>
      <div className={`key-analysis${analysing?" is-analysing":""}`}>{analysing ? <div className="key-analysis-loading"><span className="key-icon">🎼</span><div><strong>Analysing key…</strong><p>Listening for the song’s tonal centre.</p></div></div> : detectedKey ? <><div className="key-column"><span className="key-icon">🎼</span><div><span className="label">DETECTED KEY</span><strong className="key-name">{detectedKey.label}</strong><span className="key-confidence">{detectedKey.confidence}% confidence</span></div></div><div className="key-arrow"><ArrowRight size={24}/></div><div className="key-column current-key"><div><span className="label">WITH CURRENT TRANSPOSE</span><strong className="key-name">{getTransposedKey(detectedKey,pitch)}</strong><span className="key-subtitle">{pitch===0?"Same as the original key":`${pitch>0?"+":""}${pitch} semitones from original`}</span></div></div><div className="key-tip"><Lightbulb size={19}/><div><strong>A better starting point</strong><p>Use the detected key as your reference, then move a few semitones up or down until it feels comfortable.</p></div></div></> : <div className="key-analysis-empty"><span className="key-icon">🎼</span><div><strong>Automatic key analysis</strong><p>Upload a track and we’ll detect its musical key.</p></div></div>}</div>
    </section>
    <footer><span>Ready Transpose</span><span>Built for singers</span></footer>
  </main>
}