export async function peerControl<T>(port:string,route:string,body?:unknown):Promise<T>{
 if(typeof window==='undefined'||!['127.0.0.1','localhost'].includes(window.location.hostname)||window.location.protocol!=='http:')throw Error('Contacts verification requires the local Field Desk installation.');
 if(!/^\d{4,5}$/.test(port)||Number(port)<1024||Number(port)>65535)throw Error('Choose a valid local control port.');
 let response:Response;try{response=await fetch(`http://${window.location.hostname}:${port}${route}`,{method:body===undefined?'GET':'POST',headers:{'X-Field-Desk-Sync':'1',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(route==='/sync'?120000:route==='/diagnostics'?30000:20000)});}catch{throw Error('Local contacts service unavailable. Start pnpm sync or check the control port.');}
 const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'Local contacts service unavailable. Start pnpm sync, then check again.');return data as T;
}
