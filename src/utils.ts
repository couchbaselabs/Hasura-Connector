import { TableName } from "@hasura/dc-api-types";

export const coerceUndefinedToNull = <T>(v: T | undefined): T | null => v === undefined ? null : v;

export const coerceUndefinedOrNullToEmptyArray = <T>(v: Array<T> | undefined | null): Array<T> => v == null ? [] : v;

export const coerceUndefinedOrNullToEmptyRecord = <V>(v: Record<string, V> | undefined | null): Record<string, V> => v == null ? {} : v;

export const unreachable = (x: never): never => { throw new Error(`Unreachable code reached! The types lied! 😭 Unexpected value: ${x}`) };
export function omap<V, O>(m: { [x: string]: V; }, f: (k: string, v: V) => O) {
    return Object.keys(m).map(k => f(k, m[k]))
}
export const zip = <T, U>(arr1: T[], arr2: U[]): [T, U][] => {
    const length = Math.min(arr1.length, arr2.length);
    const newArray = Array(length);
    for (let i = 0; i < length; i++) {
        newArray[i] = [arr1[i], arr2[i]];
    }
    return newArray;
};
export const tableNameEquals = (tableName1: TableName) => (tableName2: TableName): boolean => {
    console.log(tableName1, tableName2);
    if (tableName1.length !== tableName2.length)
        return false;

    return zip(tableName1, tableName2).every(([n1, n2]) => n1 === n2);
}
export function isEmptyObject(obj: Record<string, any>): boolean {
    return Object.keys(obj).length === 0;
}

export function envToString(envVarName: string, defaultValue: string): string {
    const val = process.env[envVarName];
    return val === undefined ? defaultValue : val;
}

export function stringToBool(x: string | null | undefined): boolean {
    return (/1|true|t|yes|y/i).test(x || '');
}

export function envToBool(envVarName: string): boolean {
    return stringToBool(process.env[envVarName]);
}

export function envToNum(envVarName: string, defaultValue: number): number {
    const val = process.env[envVarName];
    return val === undefined ? defaultValue : Number(val);
}