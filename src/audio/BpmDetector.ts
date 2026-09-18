export const estimateBpm=(buffer:AudioBuffer):number=>{
  const sampleRate=buffer.sampleRate
  const maxSeconds=60
  const sampleCount=Math.min(buffer.length,Math.floor(sampleRate*maxSeconds))
  const blockSize=1024
  const blockCount=Math.floor(sampleCount/blockSize)

  if(blockCount<8) return 0

  const envelope=new Float32Array(blockCount)
  let previousRms=0

  // Build a simple onset envelope from short RMS energy windows.
  // Positive changes are emphasized because musical attacks are useful
  // beat indicators while sustained notes contribute less.
  for(let block=0;block<blockCount;block++){
    const start=block*blockSize
    let energy=0

    for(let i=0;i<blockSize;i++){
      let sample=0
      for(let channel=0;channel<buffer.numberOfChannels;channel++){
        sample+=buffer.getChannelData(channel)[start+i]/buffer.numberOfChannels
      }
      energy+=sample*sample
    }

    const rms=Math.sqrt(energy/blockSize)
    envelope[block]=Math.max(0,rms-previousRms)
    previousRms=rms
  }

  // Remove the DC component and normalize the onset envelope.
  let average=0
  for(const value of envelope) average+=value
  average/=envelope.length

  let variance=0
  for(let i=0;i<envelope.length;i++){
    envelope[i]-=average
    variance+=envelope[i]*envelope[i]
  }

  if(variance<1e-10) return 0

  const blocksPerSecond=sampleRate/blockSize
  let bestBpm=0
  let bestScore=-Infinity

  // Search the practical musical tempo range.
  for(let bpm=60;bpm<=180;bpm++){
    const lag=Math.round(blocksPerSecond*60/bpm)
    if(lag<1||lag>=envelope.length) continue

    let score=0
    let count=0
    for(let i=lag;i<envelope.length;i++){
      score+=envelope[i]*envelope[i-lag]
      count++
    }

    score/=Math.max(1,count)

    if(score>bestScore){
      bestScore=score
      bestBpm=bpm
    }
  }

  return bestBpm
}
