let fileData: any[];
let columns: string[] = [];

function setColumns(cols: string[]) {
    columns = cols
}
function getColumns(): string[] {
    return columns
}

function setFileData(data: any[]) {
    fileData = data;
}

function getFileData(): any[] {
    return fileData;
}

export { setFileData, getFileData }
