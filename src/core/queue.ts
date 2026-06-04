export class EventQueue {
  private items: Array<() => void> = [];
  private flushed = false;

  add(fn: () => void): void {
    if (this.flushed) {
      fn();
      return;
    }
    this.items.push(fn);
  }

  flush(): void {
    this.flushed = true;
    const items = this.items;
    this.items = [];
    for (const fn of items) fn();
  }
}
