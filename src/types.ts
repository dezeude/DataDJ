// Add Bind Button and FilterList here
interface IStack<T> {
    push(item: T): void;
    pop(): T | undefined;
    peek(): T | undefined;
    size(): number;
    isEmpty(): boolean;
}

class Stack<T> implements IStack<T> {
    private storage: T[] = [];
    private capacity: number = Infinity;

    constructor(capacity: number = Infinity) {
        this.capacity = capacity;
    }

    push(item: T): void {
        if (this.size() === this.capacity) {
            throw Error("Stack has reached max capacity, you cannot add more items");
        }
        this.storage.push(item);
    }

    pop(): T | undefined {
        return this.storage.pop();
    }

    peek(): T | undefined {
        return this.storage[this.size() - 1];
    }

    size(): number {
        return this.storage.length;
    }
    isEmpty() { return this.storage.length === 0; }

}