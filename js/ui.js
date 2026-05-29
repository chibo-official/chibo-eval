// ============================================================
// ui.js  ― 共通UI部品
// ============================================================
const UI = (() => {
  let _timer;
  function toast(msg, type='') {
    const t=document.getElementById('toast');
    t.textContent=msg; t.className='show'+(type?' '+type:'');
    clearTimeout(_timer); _timer=setTimeout(()=>t.className='',3000);
  }
  function showSaved() {
    const b=document.getElementById('savedBadge');
    b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000);
  }
  return { toast, showSaved };
})();
