import {z} from 'zod';
export const peerCapabilitiesSchema=z.object({protocol:z.literal(1),payloadKinds:z.array(z.string().min(1).max(40)).max(20),features:z.array(z.string().min(1).max(60)).max(20)}).strict();
export const PEER_CAPABILITIES={protocol:1 as const,payloadKinds:['observation','route','boundary','finding','evidence','question','service-plan','scenario'],features:['author-notices-v1','record-batches-v1','expanded-history-v1','large-packages-v1']};
export const LEGACY_CAPABILITIES={protocol:1 as const,payloadKinds:['observation','route','boundary'],features:[]};
export class PeerCompatibilityError extends Error {}
export function requirePackageCapabilities(pkg:any,capabilities:unknown){
 const peer=peerCapabilitiesSchema.parse(capabilities);
 const missing=new Set<string>();
 if(pkg.exchange&&!peer.features.includes('record-batches-v1'))missing.add('incremental record batches');
 if(!peer.features.includes('large-packages-v1')&&new TextEncoder().encode(JSON.stringify(pkg)).length>1500000)missing.add('larger shared packages');
 if(!peer.features.includes('expanded-history-v1')&&(pkg.records.length>200||pkg.records.some((r:any)=>r.revisions.length>20||r.reviews.length>100)))missing.add('expanded history limits');
 for(const record of pkg.records)for(const revision of record.revisions){
  if(!peer.payloadKinds.includes(revision.payload.kind))missing.add(revision.payload.kind);
  if(revision.notice&&!peer.features.includes('author-notices-v1'))missing.add('author corrections and withdrawals');
 }
 if(missing.size)throw new PeerCompatibilityError('Peer update required for '+[...missing].join(', ')+'. Update both instances and exchange renewed invitations. Nothing was shared.');
}
