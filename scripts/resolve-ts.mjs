// Resolve local extensionless TypeScript imports for Node's native test runner.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){try{return nextResolve(specifier,context);}catch(e){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return nextResolve(specifier+'.ts',context);throw e;}}});
