# Local speech runtime and model

Transformers.js 3.8.1 and bundled ONNX Runtime assets originate from the official @huggingface/transformers package previously verified in this project’s speech proof. Package license: [LICENSE](LICENSE).

Whisper Base English: Xenova/whisper-base.en revision 95bf40a508535962c6483ead40270b2e32267508, derived from OpenAI Whisper. Model metadata identifies Apache-2.0. Model assets download from the pinned Hugging Face revision and are cached locally; audio is never uploaded. Development validation uses existing verified local weights.

The timestamp wrapper converts the pipeline’s 100 Hz mel-frame count to Whisper’s 50 Hz encoder-frame count before DTW cropping, matching the reference implementation: https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/generation_whisper.py .

Recognition quality and alignment on sung audio are imperfect; word timestamps follow the playback clock. Recognition prepares in the background, and slow processing may delay the appearance of new words without pausing the video.
