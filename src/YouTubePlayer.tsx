import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5

type YouTubePlayerApi = {
  playVideo:()=>void
  pauseVideo:()=>void
  seekTo:(seconds:number,allowSeekAhead:boolean)=>void
  getCurrentTime:()=>number
  getDuration:()=>number
  getVideoData:()=>{title?:string}
  destroy:()=>void
}

type YouTubePlayerConstructor = new (
  element:HTMLElement,
  options:{
    videoId:string
    playerVars?:Record<string,number|string>
    events?:{
      onReady?:(event:{target:YouTubePlayerApi})=>void
      onStateChange?:(event:{target:YouTubePlayerApi,data:YouTubePlayerState})=>void
      onError?:(event:{data:number})=>void
    }
  }
)=>YouTubePlayerApi

type YouTubeWindow = Window & {
  YT?: { Player:YouTubePlayerConstructor }
  onYouTubeIframeAPIReady?:()=>void
}

let apiPromise:Promise<void>|null=null

const loadYouTubeApi=()=>{
  if(apiPromise) return apiPromise

  apiPromise=new Promise<void>((resolve)=>{
    const win=window as YouTubeWindow

    if(win.YT?.Player){
      resolve()
      return
    }

    const previous=win.onYouTubeIframeAPIReady
    win.onYouTubeIframeAPIReady=()=>{
      previous?.()
      resolve()
    }

    const existing=document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if(!existing){
      const script=document.createElement('script')
      script.src='https://www.youtube.com/iframe_api'
      script.async=true
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

export type YouTubePlayerHandle = {
  play:()=>void
  pause:()=>void
  seek: (seconds:number)=>void
  getCurrentTime:()=>number
  getDuration:()=>number
}

type Props={
  videoId:string
  onReady?:(title:string)=>void
  onStateChange?:(state:YouTubePlayerState)=>void
  onError?:(message:string)=>void
}

const YouTubePlayer=forwardRef<YouTubePlayerHandle,Props>(function YouTubePlayer(
  {videoId,onReady,onStateChange,onError},
  ref
){
  const mountRef=useRef<HTMLDivElement|null>(null)
  const playerRef=useRef<YouTubePlayerApi|null>(null)
  const onReadyRef=useRef(onReady)
  const onStateChangeRef=useRef(onStateChange)
  const onErrorRef=useRef(onError)

  useEffect(()=>{ onReadyRef.current=onReady },[onReady])
  useEffect(()=>{ onStateChangeRef.current=onStateChange },[onStateChange])
  useEffect(()=>{ onErrorRef.current=onError },[onError])

  useImperativeHandle(ref,()=>({
    play:()=>playerRef.current?.playVideo(),
    pause:()=>playerRef.current?.pauseVideo(),
    seek:(seconds)=>playerRef.current?.seekTo(seconds,true),
    getCurrentTime:()=>playerRef.current?.getCurrentTime()??0,
    getDuration:()=>playerRef.current?.getDuration()??0
  }),[])

  useEffect(()=>{
    let cancelled=false

    const createPlayer=async()=>{
      await loadYouTubeApi()
      if(cancelled||!mountRef.current)return

      const win=window as YouTubeWindow
      if(!win.YT?.Player)return

      playerRef.current?.destroy()
      mountRef.current.innerHTML=''

      playerRef.current=new win.YT.Player(mountRef.current,{
        videoId,
        playerVars:{
          autoplay:0,
          controls:1,
          enablejsapi:1,
          playsinline:1,
          origin:window.location.origin
        },
        events:{
          onReady:(event)=>{
            const title=event.target.getVideoData?.().title??'YouTube video'
            onReadyRef.current?.(title)
          },
          onStateChange:(event)=>{
            onStateChangeRef.current?.(event.data)
          },
          onError:(event)=>{
            onErrorRef.current?.(
              event.data===101||event.data===150
                ?'This YouTube video does not allow embedded playback.'
                :'YouTube could not load this video.'
            )
          }
        }
      })
    }

    createPlayer().catch(()=>{
      if(!cancelled) onErrorRef.current?.('Could not load the YouTube player.')
    })

    return()=>{
      cancelled=true
      playerRef.current?.destroy()
      playerRef.current=null
    }
  },[videoId])

  return <div className="youtube-player-wrap"><div ref={mountRef} className="youtube-player"/></div>
})

export default YouTubePlayer
