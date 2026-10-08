"use client";
import {useEffect,useState} from 'react';
const preferenceKey='manor-theme';
export function useDarkMode(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const sync=()=>{let saved:string|null=null;try{saved=localStorage.getItem(preferenceKey);}catch{}const value=saved==='dark'||saved==='light'?saved:media.matches?'dark':'light';document.documentElement.dataset.theme=value;setDark(value==='dark');};sync();const storage=(e:StorageEvent)=>{if(e.key===preferenceKey||e.key===null)sync();};media.addEventListener('change',sync);window.addEventListener('storage',storage);return()=>{media.removeEventListener('change',sync);window.removeEventListener('storage',storage);};},[]);
 function toggle(){const value=dark?'light':'dark';document.documentElement.dataset.theme=value;setDark(value==='dark');try{localStorage.setItem(preferenceKey,value);}catch{}}
 return {dark,toggle};
}
