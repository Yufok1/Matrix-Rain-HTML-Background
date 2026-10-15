# Musical accents, with Single as home

Research and verification, October 15, 2026. Local correction; publishing is separate.

The reported fault was real. On the retained 190.6-second soundtrack analysis, the previous Single/Counterflow fix spent 66.5% of playback in Counterflow and held it continuously for 13.9 seconds. Removing Crossflow had left the underlying latch intact: sustained support could keep the active pattern above its release threshold. Earlier checks covered eventual release after a breakdown, but did not require accents to finish while dense music continued. That was the missing acceptance condition.

## What the research supports

- **Detect change relative to recent context.** FluCoMa's AmpSlice compares fast and slow amplitude envelopes to identify relative rises. Its documentation also explains how smoothing affects timing. Being loud is different from a new attack. [AmpSlice](https://learn.flucoma.org/reference/ampslice/).
- **Use causal event selection.** Böck, Krebs and Schedl describe online onset detection using past context, adaptive thresholds, peak selection and minimum separation. Whole-track normalization or future-looking windows do not suit immediate live input. [ISMIR 2012 paper](https://archives.ismir.net/ismir2012/paper/000049.pdf).
- **Reject false novelty from moving spectral peaks.** Böck and Widmer's SuperFlux compares the current spectrum against a maximum-filtered earlier spectrum to suppress vibrato-related false attacks. Omni's existing dancer already has logarithmic spectral differences and adjacent-bin maximum matching. This correction reuses that input; it is not a complete SuperFlux implementation. [DAFx 2013 paper](https://www.dafx.de/paper-archive/2013/papers/09.dafx2013_submission_12.pdf).

Those sources support the detection tools. They do **not** prescribe which rain pattern should appear or an ideal percentage of screen time. The visual policy below is an original, testable design choice.

## The corrected policy

Single is the automatic baseline. An observed event is scored using spectral-flux prominence, relative energy lift and changing six-band balance. Scores are compared with up to 64 events from the last 12 seconds. Equal repeated hits receive equal rank; they cannot continually declare themselves exceptional.

A qualifying event can introduce Counterflow. Crossflow additionally needs a standout relative score, stronger flux than the recent event median, and energy lift or spectral redistribution. Neither mode is reached by advancing an internal sequence. Manual pattern choices still work normally.

Each accepted accent receives a deadline at birth. Counterflow lasts 340–780 ms; Crossflow lasts 450–980 ms, depending on event strength and reliable recent onset spacing. Further hits cannot extend it. Silence or an interrupted analysis stream ends it early. Onset spacing is a rough timing cue, not a claim of beat, bar or time-signature recognition.

After an accent, Single receives at least 2.2 times its elapsed duration, with a 750 ms minimum. Crossflow also receives a separate recovery of at least eight times its elapsed duration. These are limits on visual activity, **not target quotas**: an eligible event must still arrive after recovery. No missed event is queued, and no timer starts a new accent. Dense audio therefore cannot make either accent the mainstay.

The accepted fast direction controller, propulsion, palette, character selection and immutable trail history are unchanged. Single still physically uses one shared heading. Follow music and variable tail lengths remain off by default.

## Verification and limits

| Replay | Previous Single / Counterflow / Crossflow | Corrected Single / Counterflow / Crossflow | Longest corrected accent |
| --- | --- | --- | --- |
| Retained soundtrack analysis, 190.6 s | 33.5 / 66.5 / 0% | 87.8 / 11.3 / 0.9% | 800 ms |
| Second recording, 239.3 s, Beat turns on | 29.0 / 71.0 / 0% | 80.7 / 17.2 / 2.1% | 600 ms |

The second recording was decoded locally and analysed using a Blackman-window FFT, then replayed through the production browser spectrum adapter and dancer. It approximates the browser's spectrum acquisition; it is not a measurement of Wallpaper Engine's actual audio callback. Six replays spanning three feature scales and both Beat turns states retained 78–84% Single. These two recordings are evidence against the latch, not validation of every genre or proof of pleasing choreography.

Regression checks exercise long loud plateaus, repeated and standout attacks, dense input, silence, gaps, deterministic replay and 30/60/120 Hz updates. They verify that accents expire without extending, Single remains dominant, Crossflow remains available, and the original analyser's steering/speed results are identical. Recorded features also pass through the actual head planner to verify physical Single rather than just its highlighted button. Private recordings and feature fixtures are not distributed.
