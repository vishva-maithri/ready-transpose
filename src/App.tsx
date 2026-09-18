import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { ArrowRight, Link2, Lightbulb, Maximize2, Minimize2, Music2, PartyPopper, Pause, Play, Radio, RotateCcw, Square, Upload, Youtube } from 'lucide-react'
import { PitchEngine } from './audio/PitchEngine'
import { detectKey, KeyName } from './audio/KeyDetector'
import { estimateBpm } from './audio/BpmDetector'
import { searchYoutube, YoutubeSuggestion } from './youtubeSearch'

const SEMITONES=Array.from({length:13},(_,i)=>i-6)
const PITCH_CLASSES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']

const getTransposedKey=(key:KeyName,semitones:number)=>{
  const tonicIndex=PITCH_CLASSES.indexOf(key.tonic)
  if(tonicIndex<0) return key.label
  const nextTonic=PITCH_CLASSES[(tonicIndex+semitones+12)%12]
  return `${nextTonic} ${key.mode==='major'?'Major':'Minor'}`
}

const isYoutubeUrl=(value:string)=>/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)(\/|$)/i.test(value)

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
  const [youtubeVideoId,setYoutubeVideoId]=useState<string|null>(null)
  const [youtubeReady,setYoutubeReady]=useState(false)
  const [youtubeSuggestions,setYoutubeSuggestions]=useState<YoutubeSuggestion[]>([])
  const [youtubeSearchLoading,setYoutubeSearchLoading]=useState(false)
  const [youtubeSearchError,setYoutubeSearchError]=useState('')
  const [youtubeActiveSuggestion,setYoutubeActiveSuggestion]=useState(-1)
  const [pitchPulse,setPitchPulse]=useState(false)
  const pitchPulseTimer=useRef<number|undefined>(undefined)
  const seeking=useRef(false)
  const pendingSeek=useRef<number|null>(null)
  const engine=useRef(new PitchEngine())
  const youtubeWindow=useRef<Window|null>(null)
  const youtubeApiKey=import.meta.env.VITE_YOUTUBE_API_KEY??''

  useEffect(()=>{
    const query=url.trim()

    setYoutubeActiveSuggestion(-1)
    setYoutubeSearchError('')

    if(!query||query.length<2||isYoutubeUrl(query)){
      setYoutubeSuggestions([])
      setYoutubeSearchLoading(false)
      return
    }

    if(!youtubeApiKey){
      setYoutubeSuggestions([])
      setYoutubeSearchError('YouTube search needs a YouTube API key')
      return
    }

    const controller=new AbortController()
    const timer=window.setTimeout(async()=>{
      setYoutubeSearchLoading(true)
      try{
        const results=await searchYoutube(query,youtubeApiKey)
        if(!controller.signal.aborted){
          setYoutubeSuggestions(results)
          setYoutubeSearchError(results.length?'':'No YouTube videos found')
        }
      }catch(error){
        if(!controller.signal.aborted){
          console.error(error)
          setYoutubeSuggestions([])
          setYoutubeSearchError('Could not search YouTube right now')
        }
      }finally{
        if(!controller.signal.aborted)setYoutubeSearchLoading(false)
      }
    },450)

    return ()=>{
      window.clearTimeout(timer)
      controller.abort()
    }
  },[url,youtubeApiKey])

  useEffect(()=>{
    const handleFullscreenChange=()=>setPartyMode(document.fullscreenElement!==null)
    document.addEventListener('fullscreenchange',handleFullscreenChange)
    return ()=>document.removeEventListener('fullscreenchange',handleFullscreenChange)
  },[])

  const sendYoutubeCommand=(command:string,value?:number)=>{
    const target=youtubeWindow.current
    if(!target||target.closed)return false
    target.postMessage({type:'READY_TRANSPOSE_COMMAND',command,value},window.location.origin)
    return true
  }

  useEffect(()=>{
    const handleYoutubeMessage=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==youtubeWindow.current)return
      const message=event.data as {type?:string,title?:string,state?:number,currentTime?:number,duration?:number,message?:string}
      if(message.type==='YT_PLAYER_READY'){
        setYoutubeReady(true)
        setTrackName(message.title||'YouTube video')
        setDuration(message.duration??0)
        setStatus('YouTube player ready — capture its window audio')
        return
      }
      if(message.type==='YT_TIME'){
        setCurrentTime(message.currentTime??0)
        if((message.duration??0)>0)setDuration(message.duration??0)
        return
      }
      if(message.type==='YT_STATE'){
        const state=message.state??-1
        if(state===1){
          setPlaying(true)
          setStatus(liveCapture?'Playing — live pitch shift':'Playing')
        }else if(state===2){
          setPlaying(false)
          setStatus(liveCapture?'Paused — capture stays connected':'Paused')
        }else if(state===0){
          setPlaying(false)
          setCurrentTime(message.duration??duration)
          setStatus('Finished')
        }
        return
      }
      if(message.type==='YT_ERROR'){
        setYoutubeReady(false)
        setPlaying(false)
        setStatus(message.message||'YouTube could not load this video.')
        return
      }
      if(message.type==='YT_POPUP_CLOSED'){
        setYoutubeReady(false)
        if(liveCapture){
          engine.current.stop()
          setLiveCapture(false)
        }
        setPlaying(false)
        setStatus('YouTube player tab closed')
      }
    }
    window.addEventListener('message',handleYoutubeMessage)
    return ()=>window.removeEventListener('message',handleYoutubeMessage)
  },[liveCapture,duration])

  useEffect(()=>()=>{
    if(youtubeWindow.current&&!youtubeWindow.current.closed)youtubeWindow.current.close()
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
          const current=youtubeVideoId?currentTime:engine.current.getCurrentTime()
          const target=Math.max(0,current-5)
          if(youtubeVideoId) sendYoutubeCommand('SEEK',target)
          else engine.current.seek(target,pitch)
          setCurrentTime(target)
        }
        return
      }

      if(event.key==='ArrowRight'){
        event.preventDefault()
        if(trackName) {
          const current=youtubeVideoId?currentTime:engine.current.getCurrentTime()
          const durationValue=youtubeVideoId?duration:engine.current.getDuration()
          const target=Math.min(durationValue,current+5)
          if(youtubeVideoId) sendYoutubeCommand('SEEK',target)
          else engine.current.seek(target,pitch)
          setCurrentTime(target)
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
  },[pitch,playing,loading,trackName,youtubeVideoId])

  useEffect(()=>{
    if(!playing||youtubeVideoId)return
    const timer=window.setInterval(()=>{
      if(seeking.current)return
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
  },[playing,youtubeVideoId])

  useEffect(()=>{
    if(!liveCapture||!youtubeVideoId)return
    const timer=window.setInterval(()=>{
      if(!engine.current.isCapturing()){
        sendYoutubeCommand('PAUSE')
        setLiveCapture(false)
        setPlaying(false)
        setStatus('Capture ended — YouTube paused')
      }
    },250)
    return ()=>window.clearInterval(timer)
  },[liveCapture,youtubeVideoId])

  const selectYoutubeSuggestion=(suggestion:YoutubeSuggestion)=>{
    setUrl('https://www.youtube.com/watch?v='+suggestion.videoId)
    setYoutubeSuggestions([])
    setYoutubeSearchError('')
    setYoutubeActiveSuggestion(-1)
    window.setTimeout(()=>loadYoutube(),0)
  }

  const loadYoutube=()=>{
    const value=url.trim()
    if(!value){
      setStatus('Paste a YouTube URL first')
      return
    }

    try{
      const youtubeUrl=new URL(value.startsWith('http')?value:`https://${value}`)
      const host=youtubeUrl.hostname.replace(/^www\./,'')
      let videoId=''

      if(host==='youtu.be'){
        videoId=youtubeUrl.pathname.slice(1).split('/')[0]
      }else if(host==='youtube.com'||host.endsWith('.youtube.com')){
        if(youtubeUrl.pathname==='/watch') videoId=youtubeUrl.searchParams.get('v')??''
        else if(youtubeUrl.pathname.startsWith('/shorts/')) videoId=youtubeUrl.pathname.split('/')[2]??''
        else if(youtubeUrl.pathname.startsWith('/embed/')) videoId=youtubeUrl.pathname.split('/')[2]??''
      }

      if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)){
        setStatus('Please enter a valid YouTube video URL')
        return
      }

      engine.current.stop()
      if(youtubeWindow.current&&!youtubeWindow.current.closed)youtubeWindow.current.close()
      const popupUrl=window.location.origin+'/youtube-player?videoId='+encodeURIComponent(videoId)
      const popup=window.open(popupUrl,'ready-transpose-youtube-player')
      if(!popup){
        setStatus('Chrome blocked the player tab — allow pop-ups for Ready Transpose and try again.')
        return
      }
      youtubeWindow.current=popup
      setYoutubeVideoId(videoId)
      setYoutubeReady(false)
      setLiveCapture(false)
      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setDetectedKey(null)
      setBpm(0)
      setTrackName('Loading YouTube video…')
      setStatus('Player window opened — waiting for YouTube…')
    }catch{
      setStatus('Please enter a valid YouTube URL')
    }
  }

  const startCapture=async()=>{
    if(loading||liveCapture)return

    setLoading(true)
    setStatus('Select the Ready Transpose YouTube Player tab and enable Share audio…')
    setDetectedKey(null)
    setBpm(0)
    setAnalysing(false)

    try{
      await engine.current.captureTabAudio(pitch)
      setLiveCapture(true)
      setTrackName(youtubeVideoId?(trackName||'YouTube video'):'YouTube tab audio')
      setStatus('Live — player tab audio connected')
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
    sendYoutubeCommand('PAUSE')
    setLiveCapture(false)
    setPlaying(false)
    setStatus('Capture stopped')
  }

  const loadFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]
    if(!file||loading)return

    setLoading(true)
    engine.current.stop()
    if(youtubeWindow.current&&!youtubeWindow.current.closed)youtubeWindow.current.close()
    youtubeWindow.current=null
    setYoutubeVideoId(null)
    setYoutubeReady(false)
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

    if(youtubeVideoId){
      if(!youtubeReady){
        setStatus('YouTube player is still loading…')
        return
      }

      if(playing){
        sendYoutubeCommand('PAUSE')
        setPlaying(false)
        setStatus(liveCapture?'Paused — capture stays connected':'Paused')
      }else{
        sendYoutubeCommand('PLAY')
        setPlaying(true)
        setStatus(liveCapture?'Playing — live pitch shift':'Playing')
      }
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
    if(youtubeVideoId){
      sendYoutubeCommand('SEEK',0)
    }else{
      engine.current.seek(0,pitch)
    }
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

    if(youtubeVideoId){
      sendYoutubeCommand('SEEK',target)
      setCurrentTime(target)
    }else{
      engine.current.seek(target,pitch)
      setCurrentTime(engine.current.getCurrentTime())
    }
  }

  const changePitch=(value:number)=>{
    if(loading) return
    setPitch(value)
    setPitchPulse(false)
    if(pitchPulseTimer.current) window.clearTimeout(pitchPulseTimer.current)
    window.requestAnimationFrame(()=>setPitchPulse(true))
    pitchPulseTimer.current=window.setTimeout(()=>setPitchPulse(false),180)
    if(playing||liveCapture) engine.current.setPitch(value)
  }

  const nudgePitch=(delta:number)=>changePitch(Math.min(6,Math.max(-6,pitch+delta)))

  const handleYoutubeError=(message:string)=>{
    setYoutubeReady(false)
    setPlaying(false)
    setStatus(message)
  }


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
      {!youtubeVideoId&&<div className="party-analysis">
        <div><span className="label">CURRENT KEY</span><strong>{detectedKey?getTransposedKey(detectedKey,pitch):'—'}</strong></div>
        <div><span className="label">ORIGINAL KEY</span><strong>{detectedKey?.label||'—'}</strong></div>
        <div><span className="label">TEMPO</span><strong>{bpm>0?bpm+' BPM':'—'}</strong></div>
      </div>}
      <p className="party-hint">← → seek 5 sec&nbsp;&nbsp; • &nbsp;&nbsp;↑ ↓ transpose&nbsp;&nbsp; • &nbsp;&nbsp;Space play/pause&nbsp;&nbsp; • &nbsp;&nbsp;0 reset</p>
    </div>
  </main>

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Music2 size={19}/></div><span>Ready<span className="accent">Transpose</span></span></div><span className="prototype">PROTOTYPE</span></header>
    <section className="hero"><p className="eyebrow">KARAOKE • REAL-TIME PITCH SHIFTING</p><h1>Make any song<br/><span>singable.</span></h1><p className="hero-copy">Load a song, change the pitch, and sing along without changing the tempo.</p></section>
    <section className="input-card">
      <div className="input-heading"><div><p className="label">YOUTUBE TRACK</p><h2>Bring your song</h2></div><Youtube size={28}/></div>
      <div className="youtube-search-wrap">
        <div className="url-row"><Link2 size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{
          if(e.key==='ArrowDown'&&youtubeSuggestions.length){e.preventDefault();setYoutubeActiveSuggestion(index=>Math.min(index+1,youtubeSuggestions.length-1))}
          if(e.key==='ArrowUp'&&youtubeSuggestions.length){e.preventDefault();setYoutubeActiveSuggestion(index=>Math.max(index-1,-1))}
          if(e.key==='Enter'){
            if(youtubeActiveSuggestion>=0&&youtubeSuggestions[youtubeActiveSuggestion]){e.preventDefault();selectYoutubeSuggestion(youtubeSuggestions[youtubeActiveSuggestion])}
            else if(isYoutubeUrl(url.trim()))loadYoutube()
          }
          if(e.key==='Escape'){setYoutubeSuggestions([]);setYoutubeActiveSuggestion(-1)}
        }} onFocus={()=>{if(url.trim().length>=2&&!isYoutubeUrl(url.trim())&&!youtubeSearchError)setYoutubeSearchError('')}} placeholder="Search YouTube or paste a link…" aria-label="YouTube search or URL" disabled={loading}/><button className="primary-button" disabled={loading} onClick={loadYoutube}><Youtube size={16}/>Load</button></div>
        {(youtubeSearchLoading||youtubeSuggestions.length>0||youtubeSearchError)&&<div className="youtube-suggestions" role="listbox" aria-label="YouTube search results">
          {youtubeSearchLoading&&<div className="youtube-suggestion-message">Searching YouTube…</div>}
          {!youtubeSearchLoading&&youtubeSuggestions.map((suggestion,index)=><button key={suggestion.videoId} className={`youtube-suggestion${index===youtubeActiveSuggestion?' is-active':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>selectYoutubeSuggestion(suggestion)} role="option" aria-selected={index===youtubeActiveSuggestion}>
            <img src={suggestion.thumbnail} alt="" />
            <span><strong dangerouslySetInnerHTML={{__html:suggestion.title}}/><small>{suggestion.channelTitle}</small></span>
          </button>)}
          {!youtubeSearchLoading&&youtubeSuggestions.length===0&&youtubeSearchError&&<div className="youtube-suggestion-message">{youtubeSearchError}</div>}
        </div>}
      </div>
      {youtubeVideoId&&<div className="youtube-popup-card"><Radio size={18}/><div><strong>{youtubeReady?'YouTube player tab is ready':'Opening YouTube player window…'}</strong><span>Playback runs in a separate tab so Ready Transpose can capture and process its audio cleanly.</span></div></div>}
      <div className="capture-hint"><Radio size={15}/><span>{youtubeVideoId?'Click Capture, then select the separate “Ready Transpose — YouTube Player” tab and enable Share audio.':'Search for a song above and choose a YouTube result, or paste a YouTube link directly.'}</span></div>
      <button className={`capture-button${liveCapture?" is-live":""}`} disabled={loading&&!liveCapture||!youtubeVideoId||!youtubeReady} onClick={liveCapture?stopCapture:startCapture}>{liveCapture?<><Square size={15} fill="currentColor"/>Stop capture</>:<><Radio size={16}/>Capture player tab audio</>}</button>
      <div className="divider"><span>OR</span></div>
      <label className={`upload-zone${loading?" is-loading":""}`}><Upload size={22}/><strong>{loading?"Loading audio…":"Upload an audio file"}</strong><span>{loading?"Please wait while the track is decoded":"MP3, WAV, M4A — used for the working audio prototype"}</span><input type="file" accept="audio/*" onChange={loadFile} disabled={loading}/></label>
    </section>
    <section className="player-card">
      <div className="track-row"><div className="track-art"><Music2/></div><div className="track-info"><span className={`status status-${loading?"loading":playing?"playing":status==="Finished"?"finished":status==="Paused"?"paused":"ready"}`}><span className="status-dot"/>{status}</span><strong>{trackName||'No track loaded'}</strong></div><div className="player-actions"><button className="party-mode-button" onClick={togglePartyMode} disabled={loading||!trackName} aria-label="Enter Party Mode">
  <span className="party-sparkle party-sparkle-one">✦</span><span className="party-sparkle party-sparkle-two">✦</span>
  <span className="party-icon"><PartyPopper size={18}/></span>
  <span className="party-copy"><strong>Party Mode</strong><small>GO FULLSCREEN</small></span>
  <Maximize2 size={17}/>
</button><button className="secondary-play-button" onClick={restart} disabled={loading||!trackName} aria-label="Restart">{<RotateCcw size={18}/>}</button><button className="play-button" onClick={togglePlayback} disabled={loading} aria-label={playing?'Pause':'Play'}>{playing?<Pause fill="currentColor" size={21}/>:<Play fill="currentColor" size={21}/>}</button></div></div>
      <div className="progress-panel">
        <input className="progress-slider" type="range" min="0" max={duration||0} step="0.1" value={Math.min(currentTime,duration||0)} onPointerDown={beginSeek} onChange={e=>previewSeek(Number(e.target.value))} onPointerUp={e=>finishSeek(Number(e.currentTarget.value))} onKeyDown={e=>{if(e.key==='Enter') finishSeek(Number(e.currentTarget.value))}} disabled={loading||!duration} aria-label="Playback position"/>
        <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="pitch-panel"><div className="pitch-heading"><div><span className="label">TRANSPOSE</span><div className={`pitch-value${pitchPulse?' is-changing':''}`}>{pitch>0?'+':''}{pitch}<small> semitones</small></div><span className="keyboard-hint">↑ ↓ to transpose</span></div><div className="pitch-actions"><button className="pitch-nudge" onClick={()=>nudgePitch(-1)} disabled={loading||pitch<=-6} aria-label="Lower pitch">−</button><button className="reset" onClick={()=>changePitch(0)} disabled={loading||pitch===0}>Reset</button><button className="pitch-nudge" onClick={()=>nudgePitch(1)} disabled={loading||pitch>=6} aria-label="Raise pitch">+</button></div></div>
      <input className="pitch-slider" type="range" min="-6" max="6" step="1" value={pitch} onChange={e=>changePitch(Number(e.target.value))} disabled={loading} aria-label="Transpose pitch"/>
      <div className="semitone-grid">{SEMITONES.map(step=><button key={step} className={step===pitch?'active':''} onClick={()=>changePitch(step)} disabled={loading}>{step>0?'+':''}{step}</button>)}</div></div>
      <div className={`key-analysis${analysing?" is-analysing":""}`}>{youtubeVideoId ? <div className="key-analysis-live"><span className="key-icon"><Radio size={24}/></span><div><span className="label">LIVE AUDIO CAPTURE</span><strong>{liveCapture?"YouTube tab connected":"YouTube player ready"}</strong><p>Real-time pitch shifting is available for the YouTube player. Key and tempo analysis is not used for YouTube tracks.</p></div></div> : analysing ? <div className="key-analysis-loading"><span className="key-icon">🎼</span><div><span className="label">TRACK ANALYSIS</span><strong>Analysing key & tempo…</strong><p>Detecting the musical key and tempo from the uploaded audio.</p></div></div> : detectedKey ? <><div className="key-column"><span className="key-icon">🎼</span><div><span className="label">DETECTED KEY</span><strong className="key-name">{detectedKey.label}</strong><span className="key-confidence">{detectedKey.confidence}% confidence</span>{bpm>0&&<span className={`tempo-value${playing?" is-playing":""}`} style={{animationDuration:`${60/bpm}s`}}>♩ {bpm} BPM</span>}</div></div><div className="key-arrow"><ArrowRight size={24}/></div><div className="key-column current-key"><div><span className="label">WITH CURRENT TRANSPOSE</span><strong className="key-name">{getTransposedKey(detectedKey,pitch)}</strong><span className="key-subtitle">{pitch===0?"Same as the original key":`${pitch>0?"+":""}${pitch} semitones from original`}</span></div></div><div className="key-tip"><Lightbulb size={19}/><div><strong>A better starting point</strong><p>Use the detected key as your reference, then move a few semitones up or down until it feels comfortable.</p></div></div></> : <div className="key-analysis-empty"><span className="key-icon">🎼</span><div><strong>Automatic key analysis</strong><p>Upload a track and we’ll detect its musical key and tempo.</p></div></div>}</div>
    </section>
    <footer><span>Ready Transpose</span><span>Built for singers</span></footer>
  </main>
}