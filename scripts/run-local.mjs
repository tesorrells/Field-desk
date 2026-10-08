import {fileURLToPath} from 'node:url';
const [command='dev',port='5173',...extra]=process.argv.slice(2);
if(!['dev','build','start'].includes(command)||extra.length||!/^\d+$/.test(port)||Number(port)<1024||Number(port)>65535)throw Error('Usage: node scripts/run-local.mjs dev|build|start [port] (1024–65535).');
if(Number(process.versions.node.split('.')[0])<24)throw Error('Local Area Study requires Node.js 24 or newer (built-in SQLite).');
process.env.AREA_STUDY_LOCAL='1';
process.argv=[process.execPath,fileURLToPath(new URL('../node_modules/vinext/dist/cli.js',import.meta.url)),command,...(command==='build'?[]:['--hostname','127.0.0.1','--port',port])];
await import('../node_modules/vinext/dist/cli.js');
