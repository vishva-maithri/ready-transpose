export const fftMagnitude=(samples:Float32Array,start:number,size:number)=>{
  const real=new Float64Array(size)
  const imag=new Float64Array(size)

  for(let i=0;i<size;i++){
    const window=0.5*(1-Math.cos(2*Math.PI*i/(size-1)))
    real[i]=samples[start+i]*window
  }

  for(let i=1,j=0;i<size;i++){
    let bit=size>>1
    for(;j&bit;bit>>=1) j^=bit
    j^=bit
    if(i<j){
      const value=real[i]
      real[i]=real[j]
      real[j]=value
    }
  }

  for(let length=2;length<=size;length<<=1){
    const angle=-2*Math.PI/length
    const wLenReal=Math.cos(angle)
    const wLenImag=Math.sin(angle)
    for(let i=0;i<size;i+=length){
      let wReal=1
      let wImag=0
      const half=length>>1
      for(let j=0;j<half;j++){
        const even=i+j
        const odd=even+half
        const oddReal=real[odd]*wReal-imag[odd]*wImag
        const oddImag=real[odd]*wImag+imag[odd]*wReal
        real[odd]=real[even]-oddReal
        imag[odd]=imag[even]-oddImag
        real[even]+=oddReal
        imag[even]+=oddImag
        const nextWReal=wReal*wLenReal-wImag*wLenImag
        wImag=wReal*wLenImag+wImag*wLenReal
        wReal=nextWReal
      }
    }
  }

  const magnitude=new Float32Array(size>>1)
  for(let i=0;i<magnitude.length;i++) magnitude[i]=Math.hypot(real[i],imag[i])
  return magnitude
}
