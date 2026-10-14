// Extracted from Canvas-5 by Jeff Towers. See LICENSE.txt in this directory.
/* Local media utilities. No network, microphone, UI, or device ownership. */
(function (root) {
  "use strict";
  const api = {};
  // Show the newest recognition hypothesis, never replay a transcript on a timer.
  // Recognition supplies no word timestamps. A burst therefore replaces the window
  // once; pretending its words arrived 110 ms apart makes it race ahead or lag behind.
  // Non-instant mode holds only the trailing token while it is being revised.
  api.createSpeechWindow = function ({ emit, maxWords = 3, settleMs = 450,
    schedule = setTimeout, cancel = clearTimeout, live = null }) {
    const count = () => Math.max(1, Math.min(6,
      Math.floor(Number(live && live.maxWords) || maxWords) || 3));
    const settle = () => Math.max(80, Math.min(2000,
      Number(live && live.settleMs) || settleMs));
    let timer = null;
    let latest = "";
    let lastPhrase = "";
    let lastFinal = false;
    let generation = 0;

    function clearTimer() {
      if (timer !== null) cancel(timer);
      timer = null;
      generation += 1;
    }

    function show(words, final) {
      const phrase = Array.from(words.slice(-count()).join(" ")).slice(-64).join("");
      if (!phrase || (phrase === lastPhrase && final === lastFinal)) return;
      lastPhrase = phrase;
      lastFinal = final;
      emit(phrase, final);
    }

    return {
      reset() {
        clearTimer();
        latest = lastPhrase = "";
        lastFinal = false;
      },
      update(text, final = false) {
        const clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean || (!final && clean === latest)) return;
        latest = clean;
        clearTimer();
        const words = clean.split(" ");
        if (final || (live && live.instantWords)) {
          show(words, Boolean(final));
        } else {
          show(words.slice(0, -1), false);
          const token = generation;
          timer = schedule(() => {
            if (token !== generation) return;
            timer = null;
            show(words, false);
          }, settle());
        }
      }
    };
  };

  api.createSpeechResultPicker = function () {
    let activeIndex = -1;
    let seen = [];

    function readResult(result) {
      const text = String(result?.[0]?.transcript || "").replace(/\s+/g, " ").trim();
      return text ? { text, final: Boolean(result.isFinal) } : null;
    }

    return {
      reset() {
        activeIndex = -1;
        seen = [];
      },
      choose(event) {
        const results = event?.results;
        const length = Number(results?.length) || 0;
        if (!length) return null;
        let start = Number(event.resultIndex);
        start = Number.isFinite(start) ? Math.max(0, Math.min(length - 1, Math.floor(start))) : 0;
        if (seen.length > length) seen = seen.slice(0, length);

        let choice = null;
        for (let i = start; i < length; i += 1) {
          const next = readResult(results[i]);
          if (!next) continue;
          const previous = seen[i];
          seen[i] = next;
          if (previous && previous.text === next.text && previous.final === next.final) continue;
          if (i < activeIndex) continue;
          choice = { ...next, index: i };
        }
        if (!choice) return null;
        activeIndex = Math.max(activeIndex, choice.index);
        return choice;
      }
    };
  };

  root.Canvas5Words = api;
})(typeof window === "undefined" ? globalThis : window);
