'use strict';
const status=document.getElementById('status'),openButton=document.getElementById('open'),copyButton=document.getElementById('copy');
try {
 const raw=location.hash.slice(1);
 if(!raw||raw.length>16000)throw Error('좌표가 없는 링크입니다. 보드에서 좌표 주소를 다시 복사해주세요.');
 const p=new URLSearchParams(raw);
 for(const k of ['file','item','x','y','zoom'])if(!p.has(k)||p.getAll(k).length!==1)throw Error('불완전한 좌표 링크입니다.');
 const file=p.get('file'),normalized=file.replaceAll('\\','/');
 if(file.length>4096||!/^([a-z]:\/|\/\/[^/]+\/[^/]+)/i.test(normalized)||normalized.startsWith('//?/')||normalized.startsWith('//./')||!normalized.toLowerCase().endsWith('.amboard')||/[\x00-\x1f]/.test(file)||p.get('item').length>200)throw Error('올바른 보드 경로가 아닙니다.');
 const x=Number(p.get('x')),y=Number(p.get('y')),zoom=Number(p.get('zoom'));
 if(![x,y,zoom].every(Number.isFinite)||Math.abs(x)>2000000||Math.abs(y)>2000000||zoom<.001||zoom>20)throw Error('올바른 좌표가 아닙니다.');
 const safe=new URLSearchParams();for(const k of ['file','item','x','y','zoom','name'])if(p.has(k))safe.set(k,p.get(k));
 const native='amtool://board?'+safe.toString();
 document.getElementById('name').textContent=(p.get('name')||file.split(/[\\/]/).pop()).slice(0,200);
 openButton.href=native;openButton.hidden=false;copyButton.hidden=false;
 status.textContent='앱 열기를 요청합니다. 브라우저의 확인창을 허용해주세요. 열리지 않으면 아래 버튼을 누르세요.';
 openButton.onclick=()=>{status.textContent='amtool에서 열기를 요청했습니다. 앱이 열리지 않으면 아래 안내를 확인해주세요.';};
 copyButton.onclick=async()=>{try{await navigator.clipboard.writeText(native);status.textContent='복사했습니다. amtool의 레퍼런스 보드에서 Ctrl+V를 누르세요.';}catch{status.textContent='복사 권한이 없습니다. 주소창의 링크를 복사해 최신 amtool 보드에 붙여넣으세요.';}};
 window.setTimeout(()=>{location.href=native;},400);
}catch(error){document.getElementById('name').textContent='링크를 확인해주세요';status.textContent=error.message;}
