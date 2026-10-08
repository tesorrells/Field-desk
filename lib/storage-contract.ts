export type QueryResult<T=Record<string,unknown>>={results:T[];success:boolean;meta:{changes:number;last_row_id?:number}};
export interface StudyStatement{bind(...values:unknown[]):StudyStatement;first<T=Record<string,unknown>>(column?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<QueryResult<T>>;run():Promise<QueryResult>}
export interface StudyDatabase{prepare(sql:string):StudyStatement;batch(statements:StudyStatement[]):Promise<QueryResult[]>}
