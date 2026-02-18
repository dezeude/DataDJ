import Papa from 'papaparse'

async function initFileInput(): Promise<File> {
    return new Promise((resolve) => {
        const inputFile: HTMLInputElement = document.getElementById("input-file") as HTMLInputElement;

        if (!inputFile) {
            new Error("Input file is not in document")
        }

        inputFile.addEventListener("input", (e) => {
            if (!inputFile.files || inputFile.files.length < 1) {
                throw new Error("File missing")
            }

            const file = inputFile.files[0]

            if (!file.name.endsWith('.csv')) {
                throw new Error("File must be a CSV.")
            }
            resolve(file)
        })
    })
}

function parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data); // The data is now ready!
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

export { initFileInput, parseCSV }