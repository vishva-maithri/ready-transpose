import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link2, Music2, Pause, Play, Upload, Youtube } from 'lucide-react'
import { PitchEngine } from './audio/PitchEngine'

const SEMITONES=Array.from({length:13},(_,i)=>i-6)

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
  const [currentTime,setCurrentTime]=useState(0)
  const [duration,setDuration]=useState(0)
  const engine=useRef(new PitchEngine())

  useEffect(()=>{
    if(!playing) return
    const timer=window.setInterval(()=>{
      setCurrentTime(engine.current.getCurrentTime())
      setDuration(engine.current.getDuration())
    },100)
    return ()=>window.clearInterval(timer)
  },[playing])

  const loadFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file)return
    setStatus('Loading audio…'); setTrackName(file.name)
    try{
      await engine.current.load(file)
      setPitch(0)
      setPlaying(false)
      setCurrentTime(0)
      setDuration(engine.current.getDuration())
      setStatus('Ready to play')
    }catch(error){
      console.error(error)
      setStatus('Could not decode this audio file')
    }
  }

  const togglePlayback=()=>{
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

  const seek=(value:number)=>{
    setCurrentTime(value)
    engine.current.seek(value,pitch)
  }

  const changePitch=(value:number)=>{setPitch(value);if(playing)engine.current.setPitch(value)}

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Music2 size={19}/></div><span>Ready<span className="accent">Transpose</span></span></div><span className="prototype">PROTOTYPE</span></header>
    <section className="hero"><p className="eyebrow">KARAOKE • REAL-TIME PITCH SHIFTING</p><h1>Make any song<br/><span>singable.</span></h1><p className="hero-copy">Paste a karaoke track, find the right key, and transpose it up or down without changing the tempo.</p></section>
    <section className="input-card">
      <div className="input-heading"><div><p className="label">YOUTUBE TRACK</p><h2>Bring your song</h2></div><Youtube size={28}/></div>
      <div className="url-row"><Link2 size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" aria-label="YouTube URL"/><button className="primary-button" onClick={()=>setStatus('YouTube ingestion is the next integration step')}>Load track</button></div>
      <div className="divider"><span>OR</span></div>
      <label className="upload-zone"><Upload size={22}/><strong>Upload an audio file</strong><span>MP3, WAV, M4A — used for the working audio prototype</span><input type="file" accept="audio/*" onChange={loadFile}/></label>
    </section>
    <section className="player-card">
      <div className="track-row"><div className="track-art"><Music2/></div><div className="track-info"><span className="status">{status}</span><strong>{trackName||'No track loaded'}</strong></div><button className="play-button" onClick={togglePlayback} aria-label={playing?'Pause':'Play'}>{playing?<Pause fill="currentColor" size={21}/>:<Play fill="currentColor" size={21}/>}</button></div>
      <div className="progress-panel">
        <input className="progress-slider" type="range" min="0" max={duration||0} step="0.1" value={Math.min(currentTime,duration||0)} onChange={e=>seek(Number(e.target.value))} disabled={!duration} aria-label="Playback position"/>
        <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="pitch-panel"><div className="pitch-heading"><div><span className="label">TRANSPOSE</span><div className="pitch-value">{pitch>0?'+':''}{pitch}<small> semitones</small></div></div><button className="reset" onClick={()=>changePitch(0)}>Reset</button></div>
      <input className="pitch-slider" type="range" min="-6" max="6" step="1" value={pitch} onChange={e=>changePitch(Number(e.target.value))} aria-label="Transpose pitch"/>
      <div className="semitone-grid">{SEMITONES.map(step=><button key={step} className={step===pitch?'active':''} onClick={()=>changePitch(step)}>{step>0?'+':''}{step}</button>)}</div></div>
      <div className="key-hint"><span>🎤</span><div><strong>Next: automatic key analysis</strong><p>We’ll detect the song key and suggest a starting transpose for your voice.</p></div></div>
    </section>
    <footer><span>Ready Transpose</span><span>Built for singers</span></footer>
  </main>
}
