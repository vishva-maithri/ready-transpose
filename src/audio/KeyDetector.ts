export type KeyName = {
  tonic: string
  mode: 'major'|'minor'
  label: string
  confidence: number
}

const PITCH_CLASSES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']

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
    const current=samples[start+i]+coefficient*previous-previousPrevious
    previousPrevious=previous
    previous=current
  }

  const real=previous-previousPrevious*Math.cos(omega)
  const imaginary=previousPrevious*Math.sin(omega)
  return Math.sqrt(real*real+imaginary*imaginary)/size
}

export const detectKey=(buffer:AudioBuffer):KeyName=>{
  const channelCount=buffer.numberOfChannels
  const length=buffer.length
  const sampleRate=buffer.sampleRate
  const sampleCount=Math.min(length,Math.floor(sampleRate*45))
  const mono=new Float32Array(sampleCount)

  for(let channel=0;channel<channelCount;channel++){
    const data=buffer.getChannelData(channel)
    for(let i=0;i<sampleCount;i++) mono[i]+=data[i]/channelCount
  }

  const windowSize=4096
  const hopSize=Math.max(windowSize,Math.floor(sampleRate*0.75))
  const windows=Math.max(1,Math.min(48,Math.floor((sampleCount-windowSize)/hopSize)+1))
  const chroma=new Array(12).fill(0)

  for(let window=0;window<windows;window++){
    const start=Math.min(window*hopSize,Math.max(0,sampleCount-windowSize))
    for(let note=36;note<=84;note++){
      const frequency=440*Math.pow(2,(note-69)/12)
      if(frequency>=sampleRate/2) continue

      const magnitude=goertzel(mono,start,windowSize,frequency,sampleRate)
      chroma[note%12]+=magnitude
    }
  }

  const total=chroma.reduce((sum,value)=>sum+value,0)
  if(total<0.00001) return {tonic:'C',mode:'major',label:'C Major',confidence:0}

  const normalized=chroma.map(value=>value/total)
  const candidates:{label:string;score:number}[]=[]

  for(let tonic=0;tonic<12;tonic++){
    candidates.push({label:`${PITCH_CLASSES[tonic]} Major`,score:correlation(normalized,rotate(MAJOR_PROFILE,tonic))})
    candidates.push({label:`${PITCH_CLASSES[tonic]} Minor`,score:correlation(normalized,rotate(MINOR_PROFILE,tonic))})
  }

  candidates.sort((a,b)=>b.score-a.score)
  const best=candidates[0]
  const second=candidates[1]
  const confidence=Math.max(0,Math.min(99,Math.round(50+((best.score-second.score)*250))))
  const [tonic,mode]=best.label.split(' ')

  return {tonic,mode:mode.toLowerCase() as 'major'|'minor',label:best.label,confidence}
}
