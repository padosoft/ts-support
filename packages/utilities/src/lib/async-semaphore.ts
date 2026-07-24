/** A small FIFO semaphore used to reserve capacity in bounded resource pools. */
export class AsyncSemaphore {
	private available: number;
	private readonly capacity: number;
	private readonly waiters: Array<(release: () => void) => void> = [];

	constructor(capacity: number) {
		if (!Number.isSafeInteger(capacity) || capacity < 1) {
			throw new RangeError("Semaphore capacity must be a positive integer.");
		}
		this.capacity = capacity;
		this.available = capacity;
	}

	async acquire(): Promise<() => void> {
		if (this.available > 0) {
			this.available -= 1;
			return this.createRelease();
		}

		return new Promise((resolve) => this.waiters.push(resolve));
	}

	private createRelease(): () => void {
		let released = false;
		return () => {
			if (released) return;
			released = true;

			const next = this.waiters.shift();
			if (next) {
				next(this.createRelease());
				return;
			}

			this.available = Math.min(this.available + 1, this.capacity);
		};
	}
}
