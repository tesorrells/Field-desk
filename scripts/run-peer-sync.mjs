import '../scripts/resolve-ts.mjs';
import path from 'node:path';
import {openLocalDatabase} from '../lib/local-database.mjs';
const {startPeerSync}=await import('../lib/peer-sync.mjs');
if(Number(process.versions.node.split('.')[0])<24)throw Error('Peer sync requires Node.js 24+.');
const options={host:'127.0.0.1',port:5186,controlPort:5185,tailscale:false},args=process.argv.slice(2);
for(let i=0;i<args.length;i++){if(args[i]==='--tailscale'){options.tailscale=true;continue;}const key={'--host':'host','--port':'port','--control-port':'controlPort'}[args[i]],value=args[++i];if(!key||!value)throw Error('Usage: pnpm sync [--tailscale] [--host EXACT_IP] [--port 5186] [--control-port 5185]');options[key]=key==='host'?value:Number(value);}
if(![options.port,options.controlPort].every(p=>Number.isInteger(p)&&p>=1024&&p<=65535)||options.port===options.controlPort)throw Error('Use distinct ports from 1024–65535.');
const directory=path.resolve(process.cwd(),process.env.AREA_STUDY_DATA_DIR||'.data'),db=openLocalDatabase(directory);
const service=await startPeerSync({...options,directory,studyReader:async()=>{const row=await db.prepare("SELECT content FROM studies WHERE id='primary'").first();if(!row)throw Error('Save a study first.');return JSON.parse(row.content);}});
console.log(`Field Desk peer sync: ${service.state().endpoint}\nLocal controls: http://127.0.0.1:${options.controlPort}\n${options.tailscale?'Remote Tailscale mode: both peers need Tailscale and the companion running.':'Local/LAN mode. Use --tailscale for remote coworkers.'}\nOnly invited, selected saved contributions are published. Stop with Ctrl+C.`);
let stopping=false;async function stop(){if(stopping)return;stopping=true;await service.close();db.close();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
