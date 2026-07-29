import type { Scanner } from "./types";

export class ScannerRegistry {
  private readonly scanners = new Map<string, Scanner>();

  constructor(scanners: Scanner[] = []) {
    scanners.forEach((scanner) => this.register(scanner));
  }

  register(scanner: Scanner): void {
    const scannerId = scanner.id();

    if (this.scanners.has(scannerId)) {
      throw new Error(`Scanner is already registered: ${scannerId}`);
    }

    this.scanners.set(scannerId, scanner);
  }

  unregister(scannerId: string): boolean {
    return this.scanners.delete(scannerId);
  }

  get(scannerId: string): Scanner | undefined {
    return this.scanners.get(scannerId);
  }

  list(): Scanner[] {
    return Array.from(this.scanners.values());
  }

  sort(scanners: Scanner[] = this.list()): Scanner[] {
    return [...scanners].sort((left, right) => {
      const priorityDelta = left.priority() - right.priority();

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.id().localeCompare(right.id());
    });
  }
}
