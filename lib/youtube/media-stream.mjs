import fs from 'node:fs';
import { finished } from 'node:stream/promises';

// googleapis multipart piping does not forward errors from the source stream.
// Own both source errors and cancellation before handing the stream to the SDK.
export async function requestWithMedia(file, controller, request, openStream = fs.createReadStream) {
  const source = openStream(file);
  let rejectFault;
  const fault = new Promise((_resolve, reject) => { rejectFault = reject; });
  const onError = () => {
    const error = new Error('YOUTUBE_SOURCE_READ_FAILED');
    controller.abort(error);
    rejectFault(error);
  };
  const onAbort = () => {
    source.destroy();
    rejectFault(controller.signal.reason || new Error('YOUTUBE_CANCELLED'));
  };
  source.on('error', onError);
  controller.signal.addEventListener('abort', onAbort, { once: true });
  const closed = finished(source, { cleanup: true }).catch(() => {});
  const pending = Promise.resolve().then(() => {
    controller.signal.throwIfAborted();
    return request(source);
  });
  try { return await Promise.race([pending, fault]); }
  finally {
    source.destroy();
    await closed;
    controller.signal.removeEventListener('abort', onAbort);
    source.removeListener('error', onError);
    if (controller.signal.aborted) {
      // AbortSignal stops the real SDK transport. Keep the rejection observed and
      // wait a bounded interval even for an adapter that fails to honor abort.
      let timer;
      try { await Promise.race([pending.catch(() => {}), new Promise((resolve) => { timer = setTimeout(resolve, 2000); })]); }
      finally { clearTimeout(timer); }
    }
  }
}
