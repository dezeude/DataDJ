export const parsedData: Map<string, Float32Array> = new Map()
//TODO: rename to colData
// Col order
// Each key (column name) points to a list 
// containing the column data.
type colType = "discrete" | "continuous"
export const colTypes: Map<string, colType> = new Map()
// column name => type of rows (number or string)
export const strColMap: Map<string, Map<string | number, number>> = new Map()
//column name => row value in column => unique number for value in column
// kind of like an id for each value in the column, TODO: Don't use this for number columns. 
//Maybe keep track of all the strings each column can have, could prove useful?
export const invertedStrMap: Map<string, Map<number, string>> = new Map();
// col name => index of row => string row value
//only for string columns
export const uniques: Map<string, number> = new Map();
// Col name => # of unique values in col
export let columns: string[];
export const indices: Map<string, Map<number, Float32Array>> = new Map();
//list of indexes 
// column => cell value => list of all row indices where col[*] = cell value
export const dependents: Map<string, string> = new Map();
// Data structure for column dependencies
// column => column it depends on
// Can only depend on one column at a time
export function parseData(data: string[][]) {
    // TODO: check if each value in a column are all the same type (string or number)
    // 2D array of csv file, csv[row][column]
    // First row will have column names
    columns = data[0]
    for (let i = 0; i < columns.length; i++) {
        const colName = columns[i]

        // Check if the value can be converted to a string.
        let row = 1;
        let firstVal = data[row][i]
        while (firstVal === "" && row < data.length - 1) {
            row++
            firstVal = data[row][i]
        }
        // For this to work each column must have all numbers or all strings
        const num = parseFloat(firstVal) //NaN if failed
        if (!isNaN(num)) { //column is a number column
            colTypes.set(colName, "continuous")
            const strColValues: Set<number> = new Set()
            for (let j = 1; j < data.length; j++) {
                const rowNum = parseFloat(data[j][i]);
                if (data[j][i] === "") continue;
                if (isNaN(rowNum)) {
                    throw Error(`Column ${colName} has strings and numbers. Each column must be all strings or all numbers.`)
                }
                strColValues.add(rowNum)
            }
            const colMap: Map<number, number> = new Map();
            let count = 0;
            strColValues.forEach((val) => {
                colMap.set(val, count)
                count++;
            })
            uniques.set(colName, count)
            strColMap.set(colName, colMap)
        }
        else {
            colTypes.set(colName, "discrete")
            const strColValues: Set<string> = new Set()
            for (let j = 1; j < data.length; j++) {
                const strVal = data[j][i];
                if (data[j][i] === "") continue;
                strColValues.add(strVal)
            }
            const colMap: Map<string, number> = new Map();
            let count = 0;
            strColValues.forEach((val) => {
                colMap.set(val, count)
                count++;
            })
            uniques.set(colName, count)
            strColMap.set(colName, colMap)
        }
        // Create list of values
        // TODO: Make list a typed array of either float or integer. Float array for number values in csv, and Integer array for all the different possibilities for a string value.
        const list = new Float32Array(data.length - 1)

        // populate list of values using the column
        for (let j = 1; j < data.length; j++) {
            const datum = data[j][i]
            const num = parseFloat(datum)
            if (!isNaN(num)) { //number
                list[j - 1] = num
                //Use arrray
            }
            else {
                list[j - 1] = strColMap.get(colName)?.get(datum) as number
            }
        }

        // console.log(colName, list)

        // set the list into the map
        parsedData.set(colName, list);
    }
    // console.log(parsedData, colTypes, strColMap)
    // Inverted strings
    strColMap.forEach((map, colName) => {
        const invMap: Map<number, string> = new Map()
        if (colTypes.get(colName) === "discrete") {
            map.forEach((index, label) => {
                invMap.set(index, label as string)
            })
        }
        invertedStrMap.set(colName, invMap)
    })
}

export function getColIndex(colName: string): number {
    for (let i = 0; i < columns.length; i++) {
        if (colName === columns[i])
            return i;
    }
    return -1;
}

