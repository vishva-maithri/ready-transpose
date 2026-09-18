const API_URL='https://www.googleapis.com/youtube/v3/search'

export type YoutubeSuggestion={
  videoId:string
  title:string
  channelTitle:string
  thumbnail:string
}

export async function searchYoutube(query:string,apiKey:string):Promise<YoutubeSuggestion[]>{
  const params=new URLSearchParams({
    part:'snippet',
    type:'video',
    maxResults:'6',
    q:query,
    regionCode:'AU',
    relevanceLanguage:'en',
    videoEmbeddable:'true',
    key:apiKey
  })

  const response=await fetch(API_URL+'?'+params.toString())
  if(!response.ok){
    throw new Error('YouTube search is unavailable right now')
  }

  const data=await response.json() as {
    items?:Array<{
      id?:{videoId?:string}
      snippet?:{
        title?:string
        channelTitle?:string
        thumbnails?:{
          medium?:{url?:string}
          default?:{url?:string}
        }
      }
    }>
  }

  return (data.items??[])
    .map(item=>({
      videoId:item.id?.videoId??'',
      title:item.snippet?.title??'Untitled video',
      channelTitle:item.snippet?.channelTitle??'YouTube',
      thumbnail:item.snippet?.thumbnails?.medium?.url??item.snippet?.thumbnails?.default?.url??''
    }))
    .filter(item=>item.videoId)
}
