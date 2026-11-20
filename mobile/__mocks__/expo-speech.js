/**
 * Minimal stand-in for expo-speech under Jest. Records utterances and lets
 * tests finish, fail or stop them like the Android engine would.
 */
let last = null;
let calls = [];

function speak(text, opts = {}) {
  last = { text, opts };
  calls.push(last);
}
function stop() {
  const u = last;
  last = null;
  if (u && u.opts.onStopped) u.opts.onStopped();
}
module.exports = {
  speak,
  stop: jest.fn(stop),
  __last: () => last,
  __calls: () => calls,
  __finish: () => { const u = last; last = null; if (u && u.opts.onDone) u.opts.onDone(); },
  __fail: () => { const u = last; last = null; if (u && u.opts.onError) u.opts.onError(new Error('engine down')); },
  __reset: () => { last = null; calls = []; module.exports.stop.mockClear(); },
};
