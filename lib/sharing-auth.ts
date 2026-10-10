import {z} from 'zod';
export const publicKeySchema=z.string().regex(/^[A-Za-z0-9_-]{59}$/);
export const signatureSchema=z.string().regex(/^[A-Za-z0-9_-]{86}$/);
export const identityCardSchema=z.object({format:z.literal('field-desk-identity'),version:z.literal(1),member:z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(100)}).strict(),publicKey:publicKeySchema,signature:signatureSchema}).strict();
export const eventProofSchema=z.object({publicKey:publicKeySchema,signature:signatureSchema,signedAt:z.string().datetime()}).strict();
export const packageAuthSchema=z.object({publisher:identityCardSchema,signature:signatureSchema,events:z.record(eventProofSchema)}).strict();
export type IdentityCard=z.infer<typeof identityCardSchema>;
export type EventProof=z.infer<typeof eventProofSchema>;
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export const signingBytes=(domain:string,value:unknown)=>new TextEncoder().encode(domain+'\n'+canonical(value));
export function decode64(s:string){const bytes=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));return bytes;}
export async function fingerprint(key:string){const bytes=await crypto.subtle.digest('SHA-256',decode64(key));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('').match(/.{8}/g)!.join(' ');}
export async function verifySignature(key:string,domain:string,value:unknown,signature:string){try{const imported=await crypto.subtle.importKey('spki',decode64(key),{name:'Ed25519'},false,['verify']);return await crypto.subtle.verify('Ed25519',imported,decode64(signature),signingBytes(domain,value));}catch{return false;}}
export async function verifyIdentity(value:unknown){const card=identityCardSchema.parse(value),{signature,...body}=card;if(!await verifySignature(card.publicKey,'field-desk-identity-v1',body,signature))throw Error('Identity card signature is invalid.');return card;}
export function eventBody(groupId:string,record:any,event:any,kind:'revision'|'review',signedAt:string){return {groupId,recordId:record.id,kind,author:kind==='revision'?record.member:event.member,event,signedAt,...(kind==='review'?{revision:record.revisions.find((v:any)=>v.id===event.revisionId)}:{})};}
export function packageBody(pkg:any){const {auth,...body}=pkg;return {package:body,publisher:auth.publisher,events:auth.events};}
const verified=new WeakMap<object,string>();
export async function verifySignedPackage(pkg:any){
 if(pkg.formatVersion!==2)return {signed:false,fingerprint:null};
 const auth=packageAuthSchema.parse(pkg.auth),publisher=await verifyIdentity(auth.publisher);
 if(publisher.member.id!==pkg.sender.id||publisher.member.name!==pkg.sender.name||!await verifySignature(publisher.publicKey,'field-desk-package-v1',packageBody(pkg),auth.signature))throw Error('Package signature or publisher identity is invalid.');
 const keys=new Set<string>();
 for(const record of pkg.records)for(const kind of ['revision','review'] as const)for(const event of kind==='revision'?record.revisions:record.reviews){const key=record.id+':'+event.id,proof=auth.events[key];keys.add(key);if(!proof||!await verifySignature(proof.publicKey,'field-desk-event-v1',eventBody(pkg.group.id,record,event,kind,proof.signedAt),proof.signature))throw Error('A contribution or review signature is missing or invalid.');}
 if(keys.size!==Object.keys(auth.events).length)throw Error('Package contains unrelated signature metadata.');
 verified.set(pkg,canonical(pkg));return {signed:true,fingerprint:await fingerprint(publisher.publicKey)};
}
export function requireVerifiedPackage(pkg:any){if(pkg.formatVersion===2&&verified.get(pkg)!==canonical(pkg))throw Error('Verify this signed package before previewing or merging it.');}
