importScripts('core.js', 'ai.js');
self.onmessage = ({ data }) => {
  try { self.postMessage({ direction: AI2048Search.choose(data, 2) }); }
  catch { self.postMessage({ error: true }); }
};
