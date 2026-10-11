export class RainTrailLengths {
    constructor() {
        this.enabled = true;
        this.minimum = 12;
        this.maximum = 100;
        this.lengths = new Map();
    }
    configure(minimum, maximum) {
        this.minimum = Math.max(12, Math.min(160, Math.round(Number(minimum) || 12)));
        this.maximum = Math.max(this.minimum, Math.min(160, Math.round(Number(maximum) || 100)));
        this.lengths.clear();
    }
    lengthFor(streamId) {
        if (!this.enabled) return 40;
        const id = Number.isInteger(streamId) ? streamId : 0;
        if (!this.lengths.has(id)) {
            // Stable hash: changing direction or wrapping never rerolls a tail.
            let seed = (id + 1) | 0;
            seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
            seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
            const fraction = ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
            this.lengths.set(id, Math.round(this.minimum + fraction * (this.maximum - this.minimum)));
        }
        return this.lengths.get(id);
    }
    alpha(length, age) {
        if (!this.enabled) return Math.pow(.88, age);
        const progress = Math.max(0, Math.min(1, age / length));
        return Math.exp(-4 * progress) * (1 - progress);
    }
}
