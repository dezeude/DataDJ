import Papa from 'papaparse'
import { setupHeader } from './header';

export async function initFileInput(inputEl: HTMLInputElement) {
    if (!inputEl) {
        throw new Error("Input file is not in document")
    }

    if (!inputEl.files || inputEl.files.length < 1) {
        throw new Error("File missing")
    }
    const file = inputEl.files[0]

    if (!file.name.endsWith('.csv')) {
        throw new Error("File must be a CSV.")
    }

    await parseCSV(file).then((data: string[][]) => {
        setupHeader(data)
    });
}

function parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data);
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

export { parseCSV }