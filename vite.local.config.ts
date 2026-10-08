import vinext from 'vinext';
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({server:{host:'127.0.0.1',allowedHosts:['localhost','127.0.0.1']},resolve:{alias:[{find:/^.*\/runtime-env(?:\.ts)?$/,replacement:fileURLToPath(new URL('./lib/local-env.ts',import.meta.url))}]},plugins:[vinext()]});
