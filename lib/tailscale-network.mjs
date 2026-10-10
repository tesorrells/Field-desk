// Node-only, read-only integration with the installed Tailscale client.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const execute=promisify(execFile);
export function tailscaleIPv4(value){
 if(typeof value!=='string')return false;
 const parts=value.split('.');return parts.length===4&&parts.every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255&&String(Number(v))===v)&&Number(parts[0])===100&&Number(parts[1])>=64&&Number(parts[1])<=127;
}
export class RemoteNetworkError extends Error {constructor(message){super(message);this.name='RemoteNetworkError';}}
export function parseTailscaleStatus(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>2*1024*1024)throw Error('Invalid Tailscale status.');
 const value=JSON.parse(text);if(!value||typeof value.BackendState!=='string')throw Error('Invalid Tailscale status.');
 if(value.BackendState!=='Running')return {state:value.BackendState==='NeedsLogin'?'NeedsLogin':value.BackendState==='NeedsMachineAuth'?'NeedsApproval':'Stopped',selfIPs:[],selfOnline:false,peers:[],checkedAt:new Date().toISOString()};
 if(!value.Self||!Array.isArray(value.Self.TailscaleIPs)||(value.Peer!=null&&(typeof value.Peer!=='object'||Array.isArray(value.Peer))))throw Error('Invalid Tailscale status.');
 const peerValues=Object.values(value.Peer||{});if(peerValues.length>4096)throw Error('Tailscale peer list exceeds the supported limit.');
 return {state:'Running',selfIPs:value.Self.TailscaleIPs.filter(tailscaleIPv4),selfOnline:value.Self.Online===true,peers:peerValues.flatMap(p=>p&&Array.isArray(p.TailscaleIPs)?p.TailscaleIPs.filter(tailscaleIPv4).map(ip=>({ip,online:p.Online===true})):[]),checkedAt:new Date().toISOString()};
}
async function runStatus(){
 const candidates=['tailscale',...(process.platform==='win32'&&process.env.ProgramFiles?[path.join(process.env.ProgramFiles,'Tailscale','tailscale.exe')]:[])];
 for(const executable of candidates){try{const result=await execute(executable,['status','--json'],{timeout:5000,maxBuffer:2*1024*1024,windowsHide:true,shell:false});return result.stdout;}catch(e){if(e.code!=='ENOENT')throw e;}}
 const missing=Error('Tailscale executable unavailable');missing.code='ENOENT';throw missing;
}
export async function readTailscaleStatus(runner=runStatus){try{return parseTailscaleStatus(await runner());}catch(e){return {state:e.code==='ENOENT'?'NotInstalled':'Unavailable',selfIPs:[],selfOnline:false,peers:[],checkedAt:new Date().toISOString()};}}
export function requireTailscalePeer(status,ip){
 if(status.state!=='Running'||!status.selfOnline||!status.selfIPs.length)throw new RemoteNetworkError('Tailscale is unavailable or disconnected. Open Tailscale, sign in and connect, then retry.');
 if(status.selfIPs.includes(ip))throw new RemoteNetworkError('The invitation points to this computer. Ask the other person for their invitation.');
 const peer=status.peers.find(p=>p.ip===ip);if(!peer)throw new RemoteNetworkError('This address is not a visible Tailscale peer. Share the publisher computer with your account and accept its device invitation, then retry.');
 if(!peer.online)throw new RemoteNetworkError('Tailscale reports this peer offline. Ask them to connect Tailscale and run their Field Desk companion, then retry.');
}
export async function selectTailscaleHost(requested,runner){
 const status=await readTailscaleStatus(runner);if(status.state!=='Running'||!status.selfOnline||!status.selfIPs.length)throw new RemoteNetworkError('Tailscale must be installed, signed in and connected before starting remote sync.');
 const host=requested||status.selfIPs[0];if(!tailscaleIPv4(host)||!status.selfIPs.includes(host))throw new RemoteNetworkError('Remote sync must bind to a Tailscale IPv4 address owned by this computer.');return host;
}
