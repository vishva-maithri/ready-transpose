const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

const getMonoSample=(buffer:AudioBuffer,index:number)=>{
  let sample=0
  for(let channel=0;channel<buffer.numberOfChannels;channel++) sample+=buffer.getChannelData(channel)[index]/buffer.numberOfChannels
  return sample
}

const correlationAtLag=(values:Float32Array,lag:number)=>{
  const start=Math.ceil(lag)
  if(start>=values.length)return 0
  let numerator=0,currentEnergy=0,delayedEnergy=0
  for(let i=start;i<values.length;i++){
    const delayedIndex=i-lag
    const lower=Math.floor(delayedIndex)
    const fraction=delayedIndex-lower
    const delayed=lower+1<values.length?values[lower]+(values[lower+1]-values[lower])*fraction:0
    const current=values[i]
    numerator+=current*delayed
    currentEnergy+=current*current
    delayedEnergy+=delayed*delayed
  }
  return numerator/Math.sqrt(currentEnergy*delayedEnergy||1)
}

export const estimateBpm=(buffer:AudioBuffer):number=>{
  const sampleRate=buffer.sampleRate
  const maxSeconds=60
  const sampleCount=Math.min(buffer.length,Math.floor(sampleRate*maxSeconds))
  const hop=1024
  const blockSize=2048
  const frameCount=Math.floor((sampleCount-blockSize)/hop)
  if(frameCount<32)return 0

  // A lightweight onset envelope: compare short-time spectral/energy content
  // from one frame to the next. The positive change is the onset strength.
  // Tempo estimation then uses autocorrelation of that envelope.
  const envelope=new Float32Array(frameCount)
  let previousLow=0,previousMid=0,previousHigh=0

  for(let frame=0;frame<frameCount;frame++){
    const start=frame*hop
    let low=0,mid=0,high=0
    for(let i=0;i<blockSize;i+=4){
      const sample=getMonoSample(buffer,start+i)
      const next=getMonoSample(buffer,Math.min(sampleCount-1,start+i+1))
      const diff=Math.abs(next-sample)
      const frequencyProxy=Math.abs(sample-next)
      low+=sample*sample
      mid+=frequencyProxy
      high+=diff
    }
    low=Math.sqrt(low/(blockSize/4))
    mid/=blockSize/4
    high/=blockSize/4

    const onset=Math.max(0,mid-previousMid)*0.55+Math.max(0,high-previousHigh)*0.35+Math.max(0,low-previousLow)*0.10
    envelope[frame]=Math.log1p(onset*100)
    previousLow=low;previousMid=mid;previousHigh=high
  }

  // Remove the DC component and lightly normalize the onset envelope.
  let average=0
  for(const value of envelope)average+=value
  average/=envelope.length
  let variance=0
  for(let i=0;i<envelope.length;i++){envelope[i]-=average;variance+=envelope[i]*envelope[i]}
  if(variance<1e-8)return 0

  const frameRate=sampleRate/hop
  const candidates:{bpm:number;score:number}[]=[]
  for(let bpm=60;bpm<=180;bpm+=0.5){
    const lag=frameRate*60/bpm
    if(lag<1||lag>=envelope.length/2)continue
    const base=correlationAtLag(envelope,lag)
    const half=correlationAtLag(envelope,lag/2)
    const double=correlationAtLag(envelope,lag*2)
    // Prefer the fundamental but use subdivisions to stabilize sparse drums.
    const score=base*0.72+half*0.16+double*0.12
    candidates.push({bpm,score})
  }

  candidates.sort((a,b)=>b.score-a.score)
  if(!candidates.length)return 0

  // Avoid common octave errors by comparing the best candidate against its
  // doubled/halved alternatives and preferring the strongest fundamental.
  const best=candidates[0]
  const alternatives=candidates.filter(candidate=>Math.abs(candidate.bpm-best.bpm*2)<1||Math.abs(candidate.bpm-best.bpm/2)<1)
  const selected=alternatives.length>0?alternatives.reduce((winner,candidate)=>candidate.score>winner.score?candidate:winner,best):best
  return clamp(Math.round(selected.bpm),60,180)
}
