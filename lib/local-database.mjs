import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function openLocalDatabase(directory=path.resolve(process.cwd(),process.env.AREA_STUDY_DATA_DIR||'.data')){
 mkdirSync(directory,{recursive:true});const sqlite=new DatabaseSync(path.join(directory,'area-study.sqlite'));
 sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL);');
 try{for(const name of readdirSync(path.resolve(process.cwd(),'drizzle')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){const sql=readFileSync(path.resolve('drizzle',name),'utf8'),hash=createHash('sha256').update(sql).digest('hex'),prior=sqlite.prepare('SELECT hash FROM local_migrations WHERE name=?').get(name);if(prior){if(prior.hash!==hash)throw Error(`Applied migration ${name} changed. Restore the original migration file; do not edit applied migrations.`);continue;}sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO local_migrations(name,hash) VALUES (?,?)').run(name,hash);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}}}catch(e){sqlite.close();throw e;}
 class Statement{
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  execute(){const statement=sqlite.prepare(this.sql),results=statement.columns().length?statement.all(...this.values):[];if(!statement.columns().length)statement.run(...this.values);const meta=sqlite.prepare('SELECT changes() AS changes,last_insert_rowid() AS last_row_id').get();return {results,success:true,meta:{changes:Number(meta.changes),last_row_id:Number(meta.last_row_id)}};}
  async first(column){const row=sqlite.prepare(this.sql).get(...this.values);return column?(row?.[column]??null):(row??null);}
  async all(){return this.execute();}
  async run(){return this.execute();}
 }
 return {prepare(sql){return new Statement(sql);},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}};
}
