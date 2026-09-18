import { useEffect, useRef } from 'react'
import { Music2 } from 'lucide-react'
import YouTubePlayer, { YouTubePlayerHandle } from './YouTubePlayer'

export default function YouTubePopup(){
  const params=new URLSearchParams(window.location.search)
  const videoId=params.get('videoId')??''
  const player=useRef<YouTubePlayerHandle|null>(null)

  const post=(message:Record<string,unknown>)=>{
    if(window.opener&&!window.opener.closed){
      window.opener.postMessage(message,window.location.origin)
    }
  }

  useEffect(()=>{
    if(!videoId){
      post({type:'YT_ERROR',message:'No YouTube video was provided.'})
      return
    }

    const timer=window.setInterval(()=>{
      const current=player.current?.getCurrentTime()??0
      const duration=player.current?.getDuration()??0
      post({type:'YT_TIME',currentTime:current,duration})
    },250)

    const handleCommand=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==window.opener)return
      const message=event.data as {type?:string,command?:string,value?:number}
      if(message.type!=='READY_TRANSPOSE_COMMAND')return
      if(message.command==='PLAY')player.current?.play()
      if(message.command==='PAUSE')player.current?.pause()
      if(message.command==='SEEK')player.current?.seek(message.value??0)
    }

    window.addEventListener('message',handleCommand)
    return ()=>{
      window.clearInterval(timer)
      window.removeEventListener('message',handleCommand)
    }
  },[videoId])

  const handleReady=(title:string)=>{
    post({
      type:'YT_PLAYER_READY',
      title:title||'YouTube video',
      duration:player.current?.getDuration()??0
    })
  }

  const handleStateChange=(state:number)=>{
    post({
      type:'YT_STATE',
      state,
      currentTime:player.current?.getCurrentTime()??0,
      duration:player.current?.getDuration()??0
    })
  }

  const handleError=(message:string)=>{
    post({type:'YT_ERROR',message})
  }

  if(!videoId)return <main className="youtube-popup"><div className="youtube-popup-message">Invalid YouTube video.</div></main>

  return <main className="youtube-popup">
    <header className="youtube-popup-header">
      <div className="brand"><div className="brand-mark"><Music2 size={18}/></div><span>Ready<span className="accent">Transpose</span></span></div>
      <span>PLAYER WINDOW</span>
    </header>
    <div className="youtube-popup-video">
      <YouTubePlayer
        ref={player}
        videoId={videoId}
        onReady={handleReady}
        onStateChange={handleStateChange}
        onError={handleError}
      />
    </div>
    <p className="youtube-popup-hint">Keep this window open while Ready Transpose captures its audio.</p>
  </main>
}
