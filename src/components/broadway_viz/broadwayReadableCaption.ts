export const CAPTION_DWELL_MS = 1800;

export class BroadwayReadableCaption {
    current: string;
    pending: string | null = null;
    shownAt: number;

    constructor(text: string, now: number) {
        this.current = text;
        this.shownAt = now;
    }

    update(text: string, now: number, force = false) {
        if (text === this.current) {
            this.pending = null;
            return this.current;
        }

        this.pending = text;
        if (!force && now - this.shownAt < CAPTION_DWELL_MS) {
            return this.current;
        }

        this.current = this.pending;
        this.pending = null;
        this.shownAt = now;
        return this.current;
    }

    reset(text: string, now: number) {
        this.current = text;
        this.pending = null;
        this.shownAt = now;
        return this.current;
    }
}
