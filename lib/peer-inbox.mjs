// Private companion storage: never published, backed up with the study, or imported by UI.
import {sharedRecordDigest} from './peer-batches.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {canonical,verifySignedPackage} from './sharing-auth.ts';
import {parseSharedPackage,MAX_SHARED_BYTES} from './sharing.ts';

const MAX_ENTRIES=128,MAX_BYTES=64*1024*1024;
// Envelope/proof timestamps change on every pull. Deduplicate immutable content instead.
export function inboxDigest(pkg){return createHash('sha256').update(canonical({sender:pkg.sender,group:pkg.group,records:pkg.records.map(r=>({...r,revisions:[...r.revisions].sort((a,b)=>a.id.localeCompare(b.id)),reviews:[...r.reviews].sort((a,b)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex');}
export function openPeerInbox(directory){
 const db=new DatabaseSync(path.join(directory,'peer-inbox.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec(`CREATE TABLE IF NOT EXISTS inbox_entries(id TEXT PRIMARY KEY,peer_id TEXT NOT NULL,digest TEXT NOT NULL,package TEXT NOT NULL,received_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'Pending',reason TEXT NOT NULL DEFAULT '',reviewed_at TEXT,UNIQUE(peer_id,digest));
 CREATE TABLE IF NOT EXISTS inbox_known_records(peer_id TEXT NOT NULL,record_id TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(peer_id,record_id));
 CREATE TABLE IF NOT EXISTS inbox_checks(peer_id TEXT PRIMARY KEY,checked_at TEXT NOT NULL,received_at TEXT,records INTEGER,error TEXT);
 CREATE TABLE IF NOT EXISTS inbox_receipts(peer_id TEXT NOT NULL,digest TEXT NOT NULL,reviewed_at TEXT NOT NULL,PRIMARY KEY(peer_id,digest));`);
 const summary=row=>({id:row.id,peerId:row.peer_id,digest:row.digest,state:row.state,reason:row.reason,receivedAt:row.received_at,lastSeenAt:row.last_seen_at,reviewedAt:row.reviewed_at});
 function entries(){return db.prepare('SELECT id,peer_id,digest,state,reason,received_at,last_seen_at,reviewed_at FROM inbox_entries ORDER BY received_at DESC,rowid DESC').all().map(summary);}
 function get(id){const row=db.prepare('SELECT * FROM inbox_entries WHERE id=?').get(id);if(!row)return null;return {...summary(row),package:parseSharedPackage(row.package)};}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 return {
  entries,get,
  capacity(){const value=db.prepare('SELECT count(*) AS count,COALESCE(sum(length(CAST(package AS BLOB))),0) AS bytes FROM inbox_entries').get();return {entries:Number(value.count),bytes:Number(value.bytes),maxEntries:MAX_ENTRIES,maxBytes:MAX_BYTES};},
  known(peerId){return db.prepare('SELECT record_id AS id,digest FROM inbox_known_records WHERE peer_id=? ORDER BY record_id').all(peerId);},
  async validate(peers){
   const capacity=db.prepare('SELECT count(*) AS count,COALESCE(sum(length(CAST(package AS BLOB))),0) AS bytes FROM inbox_entries').get();
   if(capacity.count>MAX_ENTRIES||capacity.bytes>MAX_BYTES)throw Error('Persistent inbox exceeds its limits; original database was retained.');
   // Untrusted disk data is revalidated before anything can be previewed.
   for(const row of db.prepare('SELECT * FROM inbox_entries').all()){
    if(!peers.some(p=>p.id===row.peer_id)){db.prepare('DELETE FROM inbox_entries WHERE id=?').run(row.id);continue;}
    z.object({id:z.string().uuid(),peer_id:z.string().uuid(),digest:z.string().regex(/^[a-f0-9]{64}$/),received_at:z.string().datetime(),last_seen_at:z.string().datetime(),reviewed_at:z.string().datetime().nullable(),reason:z.string().max(1000),state:z.enum(['Pending','Deferred','Dismissed','Merged'])}).parse(row);
    if(Buffer.byteLength(row.package)>MAX_SHARED_BYTES)throw Error('Persistent inbox is invalid; original database was retained.');
    const pkg=parseSharedPackage(row.package);await verifySignedPackage(pkg);
    const peer=peers.find(p=>p.id===row.peer_id);
    if(pkg.formatVersion!==2||inboxDigest(pkg)!==row.digest||peer.invite.version!==3||pkg.sender.id!==peer.invite.publisher.id||pkg.group.id!==peer.invite.groupId||pkg.auth.publisher.publicKey!==peer.invite.publisherIdentity.publicKey)throw Error('Persistent inbox verification failed; original database was retained.');
   }
   for(const row of db.prepare('SELECT peer_id,record_id,digest FROM inbox_known_records').all()){z.object({peer_id:z.string().uuid(),record_id:z.string().uuid(),digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(row);if(!peers.some(p=>p.id===row.peer_id))db.prepare('DELETE FROM inbox_known_records WHERE peer_id=?').run(row.peer_id);}
   for(const row of db.prepare('SELECT peer_id,count(*) AS n FROM inbox_known_records GROUP BY peer_id').all())if(row.n>500)throw Error('Peer known-record scope exceeds its limit.');
   for(const row of db.prepare('SELECT peer_id FROM inbox_checks').all())if(!peers.some(p=>p.id===row.peer_id))this.removePeer(row.peer_id);
  },
  receive(peerId,pkg){return transaction(()=>{
   const remember=()=>{for(const record of pkg.records)db.prepare('INSERT INTO inbox_known_records(peer_id,record_id,digest) VALUES (?,?,?) ON CONFLICT(peer_id,record_id) DO UPDATE SET digest=excluded.digest').run(peerId,record.id,sharedRecordDigest(record));if(db.prepare('SELECT count(*) AS n FROM inbox_known_records WHERE peer_id=?').get(peerId).n>500)throw Error('Peer record scope exceeds its limit.');};
   const digest=inboxDigest(pkg),now=new Date().toISOString(),old=db.prepare('SELECT id FROM inbox_entries WHERE peer_id=? AND digest=?').get(peerId,digest);
   if(old){db.prepare('UPDATE inbox_entries SET last_seen_at=? WHERE id=?').run(now,old.id);remember();return get(old.id);}
   if(db.prepare('SELECT digest FROM inbox_receipts WHERE peer_id=? AND digest=?').get(peerId,digest)){remember();return null;}
   const text=JSON.stringify(pkg),capacity=db.prepare('SELECT count(*) AS count,COALESCE(sum(length(CAST(package AS BLOB))),0) AS bytes FROM inbox_entries').get();
   if(Buffer.byteLength(text)>MAX_SHARED_BYTES||capacity.count>=MAX_ENTRIES||capacity.bytes+Buffer.byteLength(text)>MAX_BYTES)throw Error('Inbox full. Clear reviewed entries before syncing again; pending updates were retained.');
   const id=randomUUID();db.prepare('INSERT INTO inbox_entries(id,peer_id,digest,package,received_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(id,peerId,digest,text,now,now);remember();return get(id);
  });},
  decide(id,digest,state,reason,expected){return transaction(()=>{
   if(!['Pending','Deferred','Dismissed','Merged'].includes(state)||typeof reason!=='string'||reason.length>1000||(['Deferred','Dismissed'].includes(state)&&!reason.trim()))throw Error('Choose a review state and supply a reason for deferring or dismissing.');
   const entry=get(id);if(!entry||entry.digest!==digest)throw Error('Inbox selection changed. Open the entry again.');
   if(expected&&(entry.state!==expected.state||entry.reviewedAt!==expected.reviewedAt))throw Error('Another tab changed this review. Refresh the inbox before deciding.');
   db.prepare('UPDATE inbox_entries SET state=?,reason=?,reviewed_at=? WHERE id=?').run(state,reason.trim(),state==='Pending'?null:new Date().toISOString(),id);return get(id);
  });},
  check(peerId,value){db.prepare('INSERT INTO inbox_checks(peer_id,checked_at,received_at,records,error) VALUES (?,?,?,?,?) ON CONFLICT(peer_id) DO UPDATE SET checked_at=excluded.checked_at,received_at=excluded.received_at,records=excluded.records,error=excluded.error').run(peerId,value.checkedAt,value.receivedAt||null,value.records??null,value.error||null);},
  checks(){return new Map(db.prepare('SELECT * FROM inbox_checks').all().map(r=>[r.peer_id,{checkedAt:r.checked_at,receivedAt:r.received_at||undefined,records:r.records??undefined,error:r.error}]));},
  removePeer(peerId){transaction(()=>{db.prepare('DELETE FROM inbox_entries WHERE peer_id=?').run(peerId);db.prepare('DELETE FROM inbox_checks WHERE peer_id=?').run(peerId);db.prepare('DELETE FROM inbox_receipts WHERE peer_id=?').run(peerId);db.prepare('DELETE FROM inbox_known_records WHERE peer_id=?').run(peerId);});},
  clearReviewed(){return transaction(()=>{
   db.exec("INSERT OR REPLACE INTO inbox_receipts(peer_id,digest,reviewed_at) SELECT peer_id,digest,reviewed_at FROM inbox_entries WHERE state IN ('Merged','Dismissed')");
   const count=db.prepare("DELETE FROM inbox_entries WHERE state IN ('Merged','Dismissed')").run().changes;
   db.exec('DELETE FROM inbox_receipts WHERE rowid NOT IN (SELECT rowid FROM inbox_receipts ORDER BY reviewed_at DESC,rowid DESC LIMIT 2048)');
   return count;
  });},
  close(){db.close();}
 };
}
