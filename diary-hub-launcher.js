/* SarNi Diary Centre launcher v3.4 — install a LOCAL copy in each dashboard repository.
 * Loads the actual private diary UI from SarNi's diary-hub.html inside a popup.
 * No passwords, API session tokens or diary content are passed between dashboards.
 */
(()=>{'use strict';
 if(document.getElementById('sarniHubLaunch'))return;
 const path=location.pathname.toLowerCase();
 const scope=path.includes('/hr/')?'office':path.includes('/analysis/')?'analysis':'all';
 const entryScope=scope==='office'?'office':scope==='analysis'?'stock':'personal';
 const root='https://saradasutar.github.io/SarNi/diary-hub.html';
 function modal(){
  const layer=document.createElement('div');layer.id='sarniHubOverlay';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','SarNi Diary Centre');
  layer.style.cssText='position:fixed;inset:0;z-index:2147483640;background:#182b27c9;padding:8px;display:flex;align-items:center;justify-content:center;';
  const box=document.createElement('div');box.style.cssText='width:min(1100px,100%);height:min(94dvh,900px);max-height:100%;border-radius:17px;overflow:hidden;background:white;box-shadow:0 20px 70px #0006;display:flex;flex-direction:column;';
  const head=document.createElement('header');head.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid #dce9e0;color:#204a38;font-weight:750;font:700 15px system-ui;';
  const label=document.createElement('span');label.textContent='SarNi · Shared Diary Centre';
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:7px;';
  const external=document.createElement('a');external.href=root+'?scope='+scope+'&kind='+entryScope;external.target='_blank';external.rel='noopener noreferrer';external.textContent='Open in new tab';external.style.cssText='padding:8px;text-decoration:none;color:#155a47;font-size:12px;';
  const close=document.createElement('button');close.type='button';close.textContent='✕ Close';close.style.cssText='border:0;background:#e7f3eb;color:#285b44;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;';
  const frame=document.createElement('iframe');frame.src=root+'?scope='+encodeURIComponent(scope)+'&kind='+encodeURIComponent(entryScope);frame.title='SarNi shared diary';frame.setAttribute('sandbox','allow-scripts allow-forms allow-popups allow-downloads allow-same-origin');frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.cssText='border:0;flex:1;width:100%;min-height:0;';
  let oldFocus=document.activeElement;
  function done(){layer.remove();document.removeEventListener('keydown',onKey);oldFocus?.focus?.();}
  function onKey(e){if(e.key==='Escape')done();}
  close.onclick=done;layer.onclick=e=>{if(e.target===layer)done();};document.addEventListener('keydown',onKey);
  actions.append(external,close);head.append(label,actions);box.append(head,frame);layer.append(box);document.body.appendChild(layer);close.focus();
 }
 const btn=document.createElement('button');btn.type='button';btn.id='sarniHubLaunch';btn.textContent=scope==='office'?'📖 Shared Office Diary':scope==='analysis'?'📖 Stock & Wisdom Diary':'📖 Diary Centre';btn.setAttribute('aria-label','Open connected SarNi Diary Centre');
 btn.style.cssText='background:#176c4f!important;color:white!important;border:0!important;min-height:40px!important;padding:9px 12px!important;cursor:pointer!important;font:700 13px system-ui!important;border-radius:12px!important;box-shadow:0 4px 15px #0f3b2650!important;';btn.onclick=modal;btn.title='Open the shared Diary Centre';btn.setAttribute('aria-haspopup','dialog');btn.title='Open the shared Diary Centre';

 // Keep the launcher accessible even when the HR sidebar is collapsed.
 function placeButton(){
   if(!document.body)return;
   if(btn.parentElement!==document.body)document.body.appendChild(btn);
   btn.className='sarni-hub-floating-launch';
   btn.style.setProperty('position','fixed','important');
   btn.style.setProperty('right','14px','important');
   btn.style.setProperty('top','max(86px, calc(env(safe-area-inset-top) + 86px))','important');
   btn.style.setProperty('bottom','auto','important');
   btn.style.setProperty('z-index','2147483000','important');
   btn.style.setProperty('display','block','important');
   btn.style.setProperty('visibility','visible','important');
   btn.style.setProperty('opacity','1','important');
   btn.style.setProperty('pointer-events','auto','important');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',placeButton,{once:true});
 else placeButton();
})();
