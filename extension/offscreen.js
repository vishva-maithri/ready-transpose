let stream = null;
let context = null;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen' || message.type !== 'START_CAPTURE') return;

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (context) {
    await context.close();
    context = null;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: message.streamId
        }
      },
      video: false
    });

    context = new AudioContext();
    const source = context.createMediaStreamSource(stream);

    // POC only: route captured tab audio directly back to the speakers.
    // SoundTouch processing will be added after clean capture is verified.
    source.connect(context.destination);
    await context.resume();

    console.log('Ready Transpose tab capture active');
  } catch (error) {
    console.error('Ready Transpose offscreen capture failed', error);
  }
});
