import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {openLocalDatabase} from '../lib/local-database.mjs';
import {localRequestAllowed} from '../lib/local-request.ts';
const directory=mkdtempSync(path.resolve('.local-storage-test-'));let db;
try{db=openLocalDatabase(directory);await db.prepare('INSERT INTO studies(id,content,updated_at) VALUES (?,?,?)').bind('primary','{}','old').run();assert.equal((await db.prepare('SELECT content FROM studies').first()).content,'{}');assert.equal((await db.prepare('SELECT content FROM studies').all()).results.length,1);assert.equal((await db.prepare('UPDATE studies SET updated_at=? WHERE updated_at=?').bind('new','missing').run()).meta.changes,0);
 await assert.rejects(db.batch([db.prepare('UPDATE studies SET content=?').bind('modified'),db.prepare('INSERT INTO briefings(id,title,created_at,scope,snapshot) VALUES (?,?,?,?,?)').bind('bad',null,'date','scope','{}')]));assert.equal((await db.prepare('SELECT content FROM studies').first()).content,'{}','Failed transaction must preserve original study');
 assert.equal((await db.prepare('INSERT INTO place_cache(id,content,fetched_at) VALUES (?,?,?) RETURNING id').bind('returning','{}','date').first()).id,'returning');db.close();db=openLocalDatabase(directory);assert.equal((await db.prepare('SELECT updated_at FROM studies').first()).updated_at,'old','Disk storage persists across connections');assert.equal((await db.prepare('SELECT name FROM local_migrations').all()).results.length,4);
 assert(localRequestAllowed(new Request('http://127.0.0.1:5173/api/study')));assert(!localRequestAllowed(new Request('http://attacker.example/api/study')));assert(!localRequestAllowed(new Request('http://localhost:5173/api/study',{headers:{Origin:'https://attacker.example'}})));assert(!localRequestAllowed(new Request('http://localhost:5173/',{headers:{'Sec-Fetch-Site':'cross-site'}})));
 console.log('Local storage passed: migrations, persistence, prepared bindings, returning rows, guarded changes, transaction rollback and loopback/origin rules.');
}finally{db?.close();if(!directory.startsWith(process.cwd()+path.sep)||!path.basename(directory).startsWith('.local-storage-test-'))throw Error('Unexpected cleanup path');rmSync(directory,{recursive:true,force:true});}
