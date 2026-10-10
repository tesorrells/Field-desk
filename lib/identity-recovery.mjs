// Offline Node-only operations. Private material must never enter a browser/control response.
import {createCipheriv,createDecipheriv,randomBytes,randomUUID,scrypt as deriveKey} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile,writeFile,stat,lstat,mkdir,rename,rm,unlink,open} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {canonical,fingerprint,verifySignature,eventBody} from './sharing-auth.ts';
import {loadSigningIdentity,validateSigningIdentity,generateSigningIdentity} from './signing-identity.mjs';
import {validatePeerConfiguration} from './peer-sync.mjs';
import {makeBackup,parseBackup,validateBackupSizes} from './backup.ts';
import {restorePortfolio} from './locations.ts';
import {openLocalDatabase} from './local-database.mjs';

const scrypt=promisify(deriveKey),LIMIT=100000000,WIRE_LIMIT=134000000;
const envelopeSchema=z.object({format:z.literal('field-desk-private-recovery'),version:z.literal(1),kdf:z.literal('scrypt-N32768-r8-p1'),salt:z.string().regex(/^[A-Za-z0-9_-]{22}$/),iv:z.string().regex(/^[A-Za-z0-9_-]{16}$/),tag:z.string().regex(/^[A-Za-z0-9_-]{22}$/),data:z.string().regex(/^[A-Za-z0-9_-]+$/).max(WIRE_LIMIT)}).strict();
const bundleSchema=z.object({format:z.literal('field-desk-private-recovery-content'),version:z.literal(1),createdAt:z.string().datetime(),identity:z.unknown(),connections:z.unknown(),backup:z.unknown()}).strict();
function password(value){if(typeof value!=='string'||value.length<12||Buffer.byteLength(value)>1024)throw Error('Use a passphrase of at least 12 characters, at most 1,024 bytes.');return value;}
async function exists(file){try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function boundedRead(file,max){const handle=await open(file,'r');try{const info=await handle.stat();if(!info.isFile()||info.size>max)throw Error('Recovery input exceeds the size limit.');const value=await handle.readFile('utf8');if(Buffer.byteLength(value)>max)throw Error('Recovery input exceeds the size limit.');return value;}finally{await handle.close();}}
async function offline(directory,stopped){if(!stopped)throw Error('Stop the app and companion, then explicitly confirm serversStopped.');if(await exists(path.join(directory,'peer-sync.lock')))throw Error('Stop the companion first. Its lock is still present.');if(await exists(path.join(directory,'field-desk-retired.json')))throw Error('This identity directory is retired. Use the replacement directory.');}
async function lockedOffline(directory,stopped,fn){directory=path.resolve(directory);await offline(directory,stopped);let lock;const file=path.join(directory,'peer-sync.lock');try{lock=await open(file,'wx',0o600);await lock.writeFile('Offline identity maintenance '+process.pid);}catch{if(lock){await lock.close();await unlink(file);}throw Error('Another companion or identity operation started. Stop it and retry.');}try{return await fn(directory);}finally{await lock.close();await unlink(file);}}
async function snapshot(directory){
 const file=path.join(directory,'area-study.sqlite');if(!await exists(file))throw Error('Save your study before backing up or recovering an identity.');
 const db=new DatabaseSync(file,{readOnly:true});try{
  db.exec('BEGIN');const row=db.prepare("SELECT content FROM studies WHERE id='primary'").get();if(!row)throw Error('Save your study first.');
  const study=restorePortfolio(JSON.parse(row.content)),briefings=db.prepare('SELECT snapshot FROM briefings ORDER BY created_at,id').all().map(r=>JSON.parse(r.snapshot));
  const backup=makeBackup(study,briefings);validateBackupSizes(backup);db.exec('COMMIT');if(!study.sharing.member)throw Error('Set your contributor identity and save first.');return backup;
 }finally{db.close();}
}
async function connections(directory){const file=path.join(directory,'peer-sync.json');return await exists(file)?JSON.parse(await boundedRead(file,1000000)):{version:1,grants:[],peers:[],contacts:[],pins:{}};}
async function validateBundle(raw){
 const bundle=bundleSchema.parse(raw),backup=parseBackup(JSON.stringify(bundle.backup)).backup;validateBackupSizes(backup);
 const identity=validateSigningIdentity(bundle.identity);
 if(identity.memberId!==backup.study.sharing.member?.id)throw Error('Recovery signing identity does not match the saved contributor.');
 const config=await validatePeerConfiguration(bundle.connections);
 for(const grant of config.grants)if(grant.policy==='pairwise-signed-v1'&&(grant.publisherKey!==identity.publicKey||grant.publisherId!==identity.memberId||config.pins[grant.recipientId]!==grant.recipientKey))throw Error('Recovery grant identity or pinned recipient is inconsistent.');
 for(const peer of config.peers)if(peer.invite.version===3&&(peer.invite.recipientIdentity.publicKey!==identity.publicKey||peer.invite.recipientId!==identity.memberId||config.pins[peer.invite.publisher.id]!==peer.invite.publisherIdentity.publicKey))throw Error('Recovery connection identity or pin is inconsistent.');
 for(const contact of config.contacts)if(config.pins[contact.id]&&config.pins[contact.id]!==contact.publicKey)throw Error('Recovery contact pin mismatch.');
 for(const group of backup.study.sharing.groups)for(const record of group.records)for(const kind of ['revision','review'])for(const event of kind==='revision'?record.revisions:record.reviews){const proof=group.signatures[record.id+':'+event.id],author=kind==='revision'?record.member.id:event.member.id;if(proof){if(author===identity.memberId&&proof.publicKey!==identity.publicKey)throw Error('Recovery identity conflicts with existing author proofs.');if(!await verifySignature(proof.publicKey,'field-desk-event-v1',eventBody(group.id,record,event,kind,proof.signedAt),proof.signature))throw Error('Recovery contains an invalid historical event signature.');}}
 return {...bundle,identity,connections:config,backup};
}
async function key(pass,salt){return Buffer.from(await scrypt(password(pass),Buffer.from(salt,'base64url'),32,{N:32768,r:8,p:1,maxmem:64000000}));}
function header(envelope){const {data,tag,...value}=envelope;return value;}
export async function encryptRecoveryBundle(bundle,passphrase){
 bundle=await validateBundle(bundle);const plain=Buffer.from(JSON.stringify(bundle));if(plain.length>LIMIT)throw Error('Recovery content exceeds 100 MB.');
 const envelope={format:'field-desk-private-recovery',version:1,kdf:'scrypt-N32768-r8-p1',salt:randomBytes(16).toString('base64url'),iv:randomBytes(12).toString('base64url')},secret=await key(passphrase,envelope.salt);
 try{const cipher=createCipheriv('aes-256-gcm',secret,Buffer.from(envelope.iv,'base64url'));cipher.setAAD(Buffer.from(canonical(envelope)));const data=Buffer.concat([cipher.update(plain),cipher.final()]);return {...envelope,tag:cipher.getAuthTag().toString('base64url'),data:data.toString('base64url')};}finally{secret.fill(0);plain.fill(0);}
}
export async function decryptRecoveryBundle(text,passphrase){
 if(typeof text!=='string'||Buffer.byteLength(text)>WIRE_LIMIT)throw Error('Recovery file exceeds the size limit.');
 const envelope=envelopeSchema.parse(JSON.parse(text)),secret=await key(passphrase,envelope.salt);let plain;
 try{const cipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(envelope.iv,'base64url'));cipher.setAAD(Buffer.from(canonical(header(envelope))));cipher.setAuthTag(Buffer.from(envelope.tag,'base64url'));try{plain=Buffer.concat([cipher.update(Buffer.from(envelope.data,'base64url')),cipher.final()]);}catch{throw Error('Wrong passphrase or altered recovery file. No files changed.');}if(plain.length>LIMIT)throw Error('Recovery content exceeds 100 MB.');return await validateBundle(JSON.parse(plain.toString('utf8')));}finally{secret.fill(0);plain?.fill(0);}
}
async function createKitUnlocked(directory,file,passphrase){
 directory=path.resolve(directory);
 const backup=await snapshot(directory),identity=await loadSigningIdentity(directory,true),config=await connections(directory);
 const bundle={format:'field-desk-private-recovery-content',version:1,createdAt:new Date().toISOString(),identity,connections:config,backup};
 const encrypted=await encryptRecoveryBundle(bundle,passphrase);
 // Never overwrite an existing recovery file, even an old kit.
 await writeFile(path.resolve(file),JSON.stringify(encrypted),{flag:'wx',mode:0o600});return recoverySummary(await validateBundle(bundle));
}
export function recoverySummary(bundle){return {createdAt:bundle.createdAt,contributor:bundle.backup.study.sharing.member,publicKey:bundle.identity.publicKey,contacts:bundle.connections.contacts.length,incoming:bundle.connections.peers.length,outgoing:bundle.connections.grants.length,groups:bundle.backup.study.sharing.groups.length,briefings:bundle.backup.briefings.length};}
async function destination(file){file=path.resolve(file);if(await exists(file))throw Error('Destination must be a new, unused data directory. Existing data is never overwritten.');await mkdir(path.dirname(file),{recursive:true});return file;}
async function materialize(bundle,directory){
 await writeFile(path.join(directory,'field-desk-identity.json'),JSON.stringify(bundle.identity),{flag:'wx',mode:0o600});
 // Polling is opt-in again after migration; preserve contact pins and exact grants.
 await writeFile(path.join(directory,'peer-sync.json'),JSON.stringify({...bundle.connections,peers:bundle.connections.peers.map(p=>({...p,automatic:false}))}),{flag:'wx',mode:0o600});
 const db=openLocalDatabase(directory);try{await db.batch([
  ...bundle.backup.briefings.map(b=>db.prepare('INSERT INTO briefings(id,title,created_at,scope,snapshot) VALUES (?,?,?,?,?)').bind(b.id,b.title,b.generatedAt,b.scope,JSON.stringify(b))),
  db.prepare('INSERT INTO studies(id,content,updated_at) VALUES (?,?,?)').bind('primary',JSON.stringify(bundle.backup.study),new Date().toISOString())
 ]);}finally{db.close();}
}
async function cleanup(directory,parent){if(path.dirname(directory)!==parent||!path.basename(directory).startsWith('.field-desk-recovery-'))throw Error('Unexpected recovery staging directory.');await rm(directory,{recursive:true,force:true});}
export async function previewRecoveryKit(file,passphrase){return recoverySummary(await decryptRecoveryBundle(await boundedRead(file,WIRE_LIMIT),passphrase));}
export async function restoreRecoveryKit(file,directory,passphrase,{serversStopped=false,confirmedContributorId,confirmedFingerprint}={}){
 if(!serversStopped)throw Error('Stop the app and companion before restoring.');
 const bundle=await decryptRecoveryBundle(await boundedRead(file,WIRE_LIMIT),passphrase),summary=recoverySummary(bundle);
 if(confirmedContributorId!==summary.contributor.id||confirmedFingerprint!==await fingerprint(summary.publicKey))throw Error('Confirm the preview contributor ID and complete fingerprint before restoring.');
 const target=await destination(directory),parent=path.dirname(target),staging=path.join(parent,'.field-desk-recovery-'+randomUUID());await mkdir(staging,{mode:0o700});
 try{await materialize(bundle,staging);if(await exists(target))throw Error('Destination appeared during restore. Nothing overwritten.');await rename(staging,target);}catch(e){await cleanup(staging,parent);throw e;}
 return summary;
}
export async function previewLostIdentity(source,{serversStopped=false}={}){return lockedOffline(source,serversStopped,async directory=>{const backup=await snapshot(directory);return {contributor:backup.study.sharing.member,groups:backup.study.sharing.groups.length};});}
async function recoverUnlocked(source,directory,{confirmedContributorId,reason}={}){
 source=path.resolve(source);const backup=await snapshot(source),old=backup.study.sharing.member;
 if(confirmedContributorId!==old.id||typeof reason!=='string'||!reason.trim()||reason.length>2000)throw Error('Confirm the old contributor ID and supply a recovery reason.');
 const target=await destination(directory);if(target===source||target.startsWith(source+path.sep)||source.startsWith(target+path.sep))throw Error('Recovery destination must be separate from the source data directory.');
 const member={id:randomUUID(),name:old.name},identity=generateSigningIdentity(member.id),prior=await validatePeerConfiguration(await connections(source));
 // Preserve old authored history with its old UUID/provenance; it cannot become locally authored under the replacement key.
 const next={...backup,study:restorePortfolio({...backup.study,sharing:{...backup.study.sharing,member}})};
 const config={...prior,grants:[],peers:[]},bundle=await validateBundle({format:'field-desk-private-recovery-content',version:1,createdAt:new Date().toISOString(),identity,connections:config,backup:next});
 const parent=path.dirname(target),staging=path.join(parent,'.field-desk-recovery-'+randomUUID()),marker=path.join(source,'field-desk-retired.json');await mkdir(staging,{mode:0o700});let retired=false;
 try{await materialize(bundle,staging);await writeFile(marker,JSON.stringify({version:1,retiredAt:new Date().toISOString(),oldContributorId:old.id,newContributorId:member.id,reason:reason.trim()}),{flag:'wx',mode:0o600});retired=true;if(await exists(target))throw Error('Destination appeared during recovery.');await rename(staging,target);}catch(e){if(retired)await unlink(marker);await cleanup(staging,parent);throw e;}
 return {...recoverySummary(bundle),previousContributorId:old.id,notice:'Old directory retired. Tell every peer to block the old identity and independently verify the new public card. Remote copies and compromised keys cannot be recalled.'};
}

export async function createRecoveryKit(directory,file,passphrase,{serversStopped=false}={}){return lockedOffline(directory,serversStopped,source=>createKitUnlocked(source,file,passphrase));}
export async function recoverLostIdentity(source,directory,options={}){return lockedOffline(source,options.serversStopped,locked=>recoverUnlocked(locked,directory,options));}
