import {z} from 'zod';
import {publicKeySchema,identityCardSchema,verifySignedPackage,fingerprint} from './sharing-auth';
import type {SharedPackage} from './sharing-schema';
export const contactSchema=z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(100),publicKey:publicKeySchema,identity:identityCardSchema.optional(),status:z.enum(['Pending','Verified','Blocked']),verifiedAt:z.string().datetime().nullable(),updatedAt:z.string().datetime()}).strict();
export const contactsSchema=z.array(contactSchema).max(64).refine(v=>new Set(v.map(c=>c.id)).size===v.length,'Duplicate contacts');
export type PeerContact=z.infer<typeof contactSchema>;
export type PackageTrust={trusted:boolean;status:'Verified'|'Local'|'Unknown'|'Pending'|'Blocked'|'Key changed'|'Unsigned'|'Unavailable';reason:string;fingerprint?:string;legacyImportAllowed?:boolean};
export async function assessPackageTrust(pkg:SharedPackage,localId:string|null,localKey:string,contacts:PeerContact[],pins:Record<string,string>):Promise<PackageTrust>{
 await verifySignedPackage(pkg);
 const authors=new Map<string,Set<string>>();
 const add=(id:string,key?:string)=>{const keys=authors.get(id)||new Set<string>();if(key)keys.add(key);authors.set(id,keys);};
 add(pkg.sender.id,pkg.auth?.publisher.publicKey);
 for(const r of pkg.records){for(const e of r.revisions)add(r.member.id,pkg.auth?.events[r.id+':'+e.id]?.publicKey);for(const e of r.reviews)add(e.member.id,pkg.auth?.events[r.id+':'+e.id]?.publicKey);}
 for(const [id,keys] of authors){const contact=contacts.find(c=>c.id===id);if(contact?.status==='Blocked'||[...keys].some(key=>contacts.some(c=>c.publicKey===key&&c.status==='Blocked')))return {trusted:false,status:'Blocked',reason:'This package involves a blocked contact.'};const expected=id===localId?localKey:contact?.publicKey||pins[id];if(expected&&[...keys].some(k=>k!==expected))return {trusted:false,status:'Key changed',reason:'A signing key differs from the saved identity. The original key was retained.'};if(pkg.formatVersion===1&&expected)return {trusted:false,status:'Unsigned',reason:'An unsigned package claims a known identity. Obtain its signed version.'};}
 if(pkg.formatVersion===1)return {trusted:false,status:'Unsigned',legacyImportAllowed:true,reason:'Unsigned legacy file: identities cannot be verified. Only a deliberate legacy import can apply it.'};
 const publisher=contacts.find(c=>c.id===pkg.sender.id);
 const fp=await fingerprint(pkg.auth!.publisher.publicKey);
 if(pkg.sender.id!==localId&&publisher?.status!=='Verified')return {trusted:false,status:publisher?.status==='Pending'?'Pending':'Unknown',fingerprint:fp,reason:'Add the publisher public identity card to Contacts, compare its fingerprint independently, and verify the contact before merging.'};
 // Pairwise receipt policy: a contact cannot deliver another contact's history.
 if(pkg.sender.id!==localId&&[...authors.keys()].some(id=>id!==pkg.sender.id&&id!==localId))return {trusted:false,status:'Blocked',fingerprint:fp,reason:'This pairwise package contains a third-party author. Obtain that contribution directly from its origin.'};
 for(const [id] of authors)if(id!==localId&&contacts.find(c=>c.id===id)?.status!=='Verified')return {trusted:false,status:'Unknown',fingerprint:fp,reason:'An event author is not a verified contact.'};
 return {trusted:true,status:pkg.sender.id===localId?'Local':'Verified',fingerprint:fp,reason:pkg.sender.id===localId?'Signed by this local identity.':'Publisher and event keys match verified contacts.'};
}
