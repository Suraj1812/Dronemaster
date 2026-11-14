// Sizes of the three ONNX files used by the current SmolVLM dtype configuration.
// Establish the whole denominator before parallel file callbacks arrive.
export const MODEL_FILES = Object.freeze({
  'onnx/embed_tokens.onnx': 189235499,
  'onnx/vision_encoder.onnx': 393190865,
  'onnx/decoder_model_merged_q4.onnx': 229119140,
});

export function createModelDownloadProgress() {
  const loaded = new Map(Object.keys(MODEL_FILES).map(file => [file, 0]));
  const finished = new Set();
  const total = Object.values(MODEL_FILES).reduce((sum, size) => sum + size, 0);
  return event => {
    if (!Object.hasOwn(MODEL_FILES, event.file)) return null;
    const size = MODEL_FILES[event.file];
    if (event.status === 'done') {
      loaded.set(event.file, size);
      finished.add(event.file);
    } else if (event.status === 'progress' && Number.isFinite(event.loaded)) {
      // A file can be read again while caching, or emit overlapping callbacks.
      loaded.set(event.file, Math.max(loaded.get(event.file), Math.min(size, Math.max(0, event.loaded))));
    } else {
      return null;
    }
    const bytes = [...loaded.values()].reduce((sum, value) => sum + value, 0);
    const complete = finished.size === loaded.size;
    return {loaded: bytes, total, percent: complete ? 100 : Math.min(99, Math.floor(bytes / total * 100)), complete};
  };
}
