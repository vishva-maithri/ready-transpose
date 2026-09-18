import { fftMagnitude } from './Fft'

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
  const aMean=mean(a),bMean=mean(b)
  let numerator=0,aDenominator=0,bDenominator=0
  for(let i=0;i<a.length;i++){
    const x=a[i]-aMean,y=b[i]-bMean
    numerator+=x*y;aDenominator+=x*x;bDenominator+=y*y
  }
  return numerator/Math.sqrt(aDenominator*bDenominator||1)
}
const rotate=(profile:number[],offset:number)=>profile.map((_,index)=>profile[(index-offset+12)%12])

export const detectKey=(buffer:AudioBuffer):KeyName=>{
  const sampleRate=buffer.sampleRate
  const maxSeconds=60
  const sampleCount=Math.min(buffer.length,Math.floor(sampleRate*maxSeconds))
  const mono=new Float32Array(sampleCount)

  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const data=buffer.getChannelData(channel)
    for(let i=0;i<sampleCount;i++) mono[i]+=data[i]/buffer.numberOfChannels
  }

  let rms=0
  for(const sample of mono) rms+=sample*sample
  rms=Math.sqrt(rms/Math.max(1,sampleCount))
  if(!Number.isFinite(rms)||rms<0.00001)return {tonic:'C',mode:'major',label:'C Major',confidence:0}

  const fftSize=4096
  const hop=2048
  const frameCount=Math.max(1,Math.floor((sampleCount-fftSize)/hop)+1)
  const frameLimit=Math.min(32,frameCount)
  const chroma=new Array(12).fill(0)

  // Build a chromagram from the spectrum. Unlike the old fixed-frequency
  // Goertzel approach, this tolerates slight tuning differences and naturally
  // folds harmonics across octaves into the same pitch class.
  for(let frame=0;frame<frameLimit;frame++){
    const progress=frameLimit===1?0:frame/(frameLimit-1)
    const frameIndex=Math.round(progress*Math.max(0,frameCount-1))
    const start=frameIndex*hop
    const magnitude=fftMagnitude(mono,start,fftSize)
    const frameChroma=new Array(12).fill(0)

    for(let bin=1;bin<magnitude.length;bin++){
      const frequency=bin*sampleRate/fftSize
      if(frequency<55||frequency>2500)continue

      const midi=69+12*Math.log2(frequency/440)
      const nearest=Math.round(midi)
      const cents=Math.abs((midi-nearest)*100)
      if(cents>55)continue

      const pitchClass=((nearest%12)+12)%12
      const tuningWeight=Math.cos((cents/55)*Math.PI/2)
      const octaveWeight=frequency<1000?1:0.65
      const magnitudeWeight=Math.pow(magnitude[bin],0.8)
      frameChroma[pitchClass]+=magnitudeWeight*tuningWeight*octaveWeight
    }

    const frameTotal=frameChroma.reduce((sum,value)=>sum+value,0)
    if(frameTotal>0){
      for(let note=0;note<12;note++) chroma[note]+=frameChroma[note]/frameTotal
    }
  }

  const total=chroma.reduce((sum,value)=>sum+value,0)
  if(!Number.isFinite(total)||total<=0)return {tonic:'C',mode:'major',label:'C Major',confidence:0}

  const normalized=chroma.map(value=>value/total)
  const candidates:{tonic:number;mode:'major'|'minor';label:string;score:number}[]=[]
  for(let tonic=0;tonic<12;tonic++){
    candidates.push({tonic,mode:'major',label:`${PITCH_CLASSES[tonic]} Major`,score:correlation(normalized,rotate(MAJOR_PROFILE,tonic))})
    candidates.push({tonic,mode:'minor',label:`${PITCH_CLASSES[tonic]} Minor`,score:correlation(normalized,rotate(MINOR_PROFILE,tonic))})
  }

  candidates.sort((a,b)=>b.score-a.score)
  const best=candidates[0],second=candidates[1]
  const separation=Math.max(0,best.score-second.score)
  const confidence=Math.max(0,Math.min(99,Math.round(separation*700)))
  return {tonic:PITCH_CLASSES[best.tonic],mode:best.mode,label:best.label,confidence}
}
