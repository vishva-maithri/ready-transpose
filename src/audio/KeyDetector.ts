export type KeyName = {
  tonic: string
  mode: 'major'|'minor'
  label: string
  confidence: number
}

const PITCH_CLASSES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']

// Krumhansl-Schmuckler tonal profiles.
// The detector compares the song's chroma distribution with every
// transposition of these major/minor profiles.
const MAJOR_PROFILE=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
const MINOR_PROFILE=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]

const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length

const correlation=(a:number[],b:number[])=>{
  const aMean=mean(a)
  const bMean=mean(b)
  let numerator=0
  let aDenominator=0
  let bDenominator=0

  for(let i=0;i<a.length;i++){
    const x=a[i]-aMean
    const y=b[i]-bMean
    numerator+=x*y
    aDenominator+=x*x
    bDenominator+=y*y
  }

  return numerator/Math.sqrt(aDenominator*bDenominator||1)
}

const rotate=(profile:number[],offset:number)=>
  profile.map((_,index)=>profile[(index-offset+12)%12])

const goertzel=(samples:Float32Array,start:number,size:number,frequency:number,sampleRate:number)=>{
  const omega=2*Math.PI*frequency/sampleRate
  const coefficient=2*Math.cos(omega)
  let previous=0
  let previousPrevious=0

  for(let i=0;i<size;i++){
    // Hann window reduces spectral leakage, which is important for music.
    const window=0.5*(1-Math.cos(2*Math.PI*i/(size-1)))
    const current=samples[start+i]*window+coefficient*previous-previousPrevious
    previousPrevious=previous
    previous=current
  }

  const real=previous-previousPrevious*Math.cos(omega)
  const imaginary=previousPrevious*Math.sin(omega)
  return Math.sqrt(real*real+imaginary*imaginary)/size
}

const addNoteEnergy=(chroma:number[],samples:Float32Array,start:number,size:number,note:number,sampleRate:number)=>{
  const fundamental=440*Math.pow(2,(note-69)/12)
  if(fundamental>=sampleRate/2) return

  // Music often has a stronger harmonic than its fundamental.
  // Weight the fundamental most heavily, then add lower harmonics.
  const harmonics=[
    [fundamental,1],
    [fundamental*2,0.55],
    [fundamental*3,0.35],
    [fundamental*4,0.2]
  ] as const

  let energy=0
  for(const [frequency,weight] of harmonics){
    if(frequency<sampleRate/2) energy+=goertzel(samples,start,size,frequency,sampleRate)*weight
  }

  chroma[note%12]+=energy
}

export const detectKey=(buffer:AudioBuffer):KeyName=>{
  const channelCount=buffer.numberOfChannels
  const sampleRate=buffer.sampleRate
  const maxSeconds=60
  const sampleCount=Math.min(buffer.length,Math.floor(sampleRate*maxSeconds))
  const mono=new Float32Array(sampleCount)

  for(let channel=0;channel<channelCount;channel++){
    const data=buffer.getChannelData(channel)
    for(let i=0;i<sampleCount;i++) mono[i]+=data[i]/channelCount
  }

  let rms=0
  for(const sample of mono) rms+=sample*sample
  rms=Math.sqrt(rms/Math.max(1,mono.length))

  if(!Number.isFinite(rms)||rms<0.00001){
    return {tonic:'C',mode:'major',label:'C Major',confidence:0}
  }

  const windowSize=4096
  const segmentCount=Math.min(24,Math.max(1,Math.floor(sampleCount/windowSize)))
  const chroma=new Array(12).fill(0)

  // Spread analysis across the track rather than relying only on its intro.
  for(let segment=0;segment<segmentCount;segment++){
    const progress=segmentCount===1?0:segment/(segmentCount-1)
    const start=Math.round(progress*Math.max(0,sampleCount-windowSize))

    for(let note=36;note<=84;note++){
      addNoteEnergy(chroma,mono,start,windowSize,note,sampleRate)
    }
  }

  const total=chroma.reduce((sum,value)=>sum+value,0)
  if(!Number.isFinite(total)||total<=0){
    return {tonic:'C',mode:'major',label:'C Major',confidence:0}
  }

  const normalized=chroma.map(value=>value/total)
  const candidates:{tonic:number;mode:'major'|'minor';label:string;score:number}[]=[]

  for(let tonic=0;tonic<12;tonic++){
    candidates.push({
      tonic,
      mode:'major',
      label:`${PITCH_CLASSES[tonic]} Major`,
      score:correlation(normalized,rotate(MAJOR_PROFILE,tonic))
    })
    candidates.push({
      tonic,
      mode:'minor',
      label:`${PITCH_CLASSES[tonic]} Minor`,
      score:correlation(normalized,rotate(MINOR_PROFILE,tonic))
    })
  }

  candidates.sort((a,b)=>b.score-a.score)
  const best=candidates[0]
  const second=candidates[1]

  // Confidence is intentionally conservative: close alternatives mean
  // the song may be ambiguous (for example relative major/minor keys).
  const separation=Math.max(0,best.score-second.score)
  const confidence=Math.max(0,Math.min(99,Math.round(separation*900)))

  return {
    tonic:PITCH_CLASSES[best.tonic],
    mode:best.mode,
    label:best.label,
    confidence
  }
}
