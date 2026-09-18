const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

const getMonoRms=(buffer:AudioBuffer,start:number,size:number)=>{
  let energy=0
  const channelCount=buffer.numberOfChannels
  const channels=Array.from({length:channelCount},(_,channel)=>buffer.getChannelData(channel))

  for(let i=0;i<size;i++){
    let sample=0
    for(const channel of channels) sample+=channel[start+i]/channelCount
    energy+=sample*sample
  }

  return Math.sqrt(energy/size)
}

const interpolate=(values:Float32Array,index:number)=>{
  if(index<0||index>=values.length-1) return 0
  const lower=Math.floor(index)
  const fraction=index-lower
  return values[lower]+(values[lower+1]-values[lower])*fraction
}

const correlationAtLag=(envelope:Float32Array,lag:number)=>{
  const start=Math.ceil(lag)
  if(start>=envelope.length) return 0

  let numerator=0
  let currentEnergy=0
  let delayedEnergy=0

  for(let i=start;i<envelope.length;i++){
    const current=envelope[i]
    const delayed=interpolate(envelope,i-lag)
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

  // 512 samples gives a finer temporal grid than the first version while
  // keeping the analysis lightweight enough for a browser prototype.
  const blockSize=512
  const blockCount=Math.floor(sampleCount/blockSize)

  if(blockCount<16) return 0

  const envelope=new Float32Array(blockCount)
  let previousEnergy=0

  // Spectral-flux-style energy envelope. Log compression prevents loud
  // sections from dominating quieter sections of the song.
  for(let block=0;block<blockCount;block++){
    const energy=Math.log1p(getMonoRms(buffer,block*blockSize,blockSize)*100)
    envelope[block]=Math.max(0,energy-previousEnergy)
    previousEnergy=energy
  }

  // Remove the mean and normalize so correlation measures rhythm rather
  // than absolute track loudness.
  let average=0
  for(const value of envelope) average+=value
  average/=envelope.length

  let variance=0
  for(let i=0;i<envelope.length;i++){
    envelope[i]-=average
    variance+=envelope[i]*envelope[i]
  }

  if(variance<1e-10) return 0

  const blocksPerMinute=(sampleRate/blockSize)*60
  let bestBpm=0
  let bestScore=-Infinity

  // Search in half-BPM increments. Fractional lag interpolation avoids
  // quantization caused by rounding the beat period to a whole block.
  for(let bpm=50;bpm<=200;bpm+=0.5){
    const lag=blocksPerMinute/bpm
    if(lag>=envelope.length) continue

    const fundamental=correlationAtLag(envelope,lag)
    const doubleBeat=correlationAtLag(envelope,lag*2)
    const halfBeat=lag/2<1?0:correlationAtLag(envelope,lag/2)

    // A real beat should have repeated energy at the beat period and often
    // at the next subdivision. Small harmonic support improves stability
    // without aggressively forcing double-time or half-time interpretations.
    const score=fundamental*0.68+doubleBeat*0.22+halfBeat*0.10

    if(score>bestScore){
      bestScore=score
      bestBpm=bpm
    }
  }

  // Very small floating-point noise can produce a .5 result when the song
  // clearly sits on a whole-number tempo.
  return Number.isInteger(bestBpm)?bestBpm:clamp(Math.round(bestBpm*2)/2,50,200)
}
