type CheckResult = { cursor: string; changed: boolean };
type Options = {
  cursor: string | null;
  check: (cursor: string | null) => Promise<CheckResult>;
  visible: () => boolean;
  busy: () => boolean;
  refresh: () => void;
  now?: () => number;
};
/** Transport-independent controller: no overlapping requests or refresh during edits. */
export class ChangeRefreshController {
  private cursor: string | null;
  private pending = false;
  private running = false;
  private stopped = false;
  private lastCheck = -Infinity;
  private failures = 0;
  constructor(private options: Options) {
    this.cursor = options.cursor;
  }
  stop() {
    this.stopped = true;
  }
  flush() {
    if (
      !this.stopped &&
      this.pending &&
      this.options.visible() &&
      !this.options.busy()
    ) {
      this.pending = false;
      this.options.refresh();
    }
  }
  async poll(): Promise<number> {
    if (this.stopped) return 300000;
    this.flush();
    const now = (this.options.now ?? Date.now)();
    if (!this.options.visible()) return 15000;
    if (this.running || now - this.lastCheck < 5000) return 5000;
    this.running = true;
    this.lastCheck = now;
    try {
      const result = await this.options.check(this.cursor);
      if (this.stopped) return 300000;
      this.cursor = result.cursor;
      this.pending = this.pending || result.changed;
      this.failures = 0;
      this.flush();
      return 15000;
    } catch {
      this.failures = Math.min(5, this.failures + 1);
      return Math.min(300000, 15000 * 2 ** this.failures);
    } finally {
      this.running = false;
    }
  }
}
