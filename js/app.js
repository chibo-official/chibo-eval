// ============================================================
// app.js  ― アプリケーションのメイン制御
// ============================================================

const App = (() => {
  let MEMBERS = [];
  let stateMap = {};
  let currentTab = 'summary';
  let pendingSet = new Set();
  const PROC = CONFIG.PROC_ITEMS;
  const GR   = CONFIG.GRADE_RATIO;

  // ── 起動 ─────────────────────────────────────────────────
  async function init() {
    try {
      const masterRes = await API.getMaster();
      if (!masterRes.ok) throw new Error(masterRes.error);
      MEMBERS = masterRes.members;
      MEMBERS.forEach(m => {
        stateMap[m.id] = {
          kpis: m.kpis.map(() => ({ midGrade:'', midComment:'', finGrade:'', finComment:'' })),
          proc: PROC.map(()  => ({ midGrade:'', midComment:'', finGrade:'', finComment:'' })),
        };
      });
      const scoresRes = await API.getAllScores();
      if (!scoresRes.ok) throw new Error(scoresRes.error);
      scoresRes.scores.forEach(s => {
        const st = stateMap[s.member_id];
        if (!st) return;
        const idx = Number(s.item_index);
        if (s.type === 'kpi' && st.kpis[idx]) {
          if (s.phase === 'mid') { st.kpis[idx].midGrade = s.grade; st.kpis[idx].midComment = s.comment; }
          else                   { st.kpis[idx].finGrade = s.grade; st.kpis[idx].finComment = s.comment; }
        } else if (s.type === 'proc' && st.proc[idx]) {
          if (s.phase === 'mid') { st.proc[idx].midGrade = s.grade; st.proc[idx].midComment = s.comment; }
          else                   { st.proc[idx].finGrade = s.grade; st.proc[idx].finComment = s.comment; }
        }
      });
      render();
    } catch (err) {
      document.getElementById('content').innerHTML =
        `<div class="loading" style="color:var(--red)">読み込みに失敗しました。<br>${err.message}<br><br>
         <button class="btn-primary" onclick="location.reload()">再読み込み</button></div>`;
    }
  }

  // ── レンダリング ─────────────────────────────────────────
  function render() { renderNav(); renderContent(); }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    const tabs = [
      { id:'summary', label:'集計サマリー' },
      { id:'kpilist', label:'課題一覧' },
      ...MEMBERS.map(m => ({ id: m.id, label: m.name.replace(' ','') })),
    ];
    tabs.forEach(t => {
      const b = document.createElement('button');
      b.className = 'nav-btn' + (currentTab === t.id ? ' active' : '');
      b.textContent = t.label + (pendingSet.has(t.id) ? ' *' : '');
      b.onclick = () => { currentTab = t.id; render(); };
      nav.appendChild(b);
    });
  }

  function renderContent() {
    const c = document.getElementById('content');
    if      (currentTab === 'summary') renderSummary(c);
    else if (currentTab === 'kpilist') renderKpiList(c);
    else {
      const m = MEMBERS.find(x => x.id === currentTab);
      if (m) renderMember(c, m);
    }
  }

  // ── スコア計算 ────────────────────────────────────────────
  function calcKpi(mid, phase) {
    const m = MEMBERS.find(x => x.id === mid);
    const s = stateMap[mid];
    let total = 0, any = false;
    m.kpis.forEach((k, i) => {
      const g = phase === 'mid' ? s.kpis[i].midGrade : s.kpis[i].finGrade;
      if (g) { any = true; total += k.weight / 100 * 60 * (GR[g] || 0); }
    });
    return any ? total : null;
  }
  function calcProc(mid, phase) {
    const s = stateMap[mid];
    let t = 0, any = false;
    s.proc.forEach(p => {
      const g = phase === 'mid' ? p.midGrade : p.finGrade;
      if (g) { any = true; t += 8 * (GR[g] || 0); }
    });
    return any ? t : null;
  }
  function rank(pts) {
    if (pts === null || pts === undefined) return '';
    if (pts >= 90) return 'S'; if (pts >= 80) return 'A';
    if (pts >= 70) return 'B'; if (pts >= 60) return 'C'; return 'D';
  }
  function fmt(v) { return v === null ? '—' : v.toFixed(1); }
  function kpiPts(k, g)  { return g ? k.weight / 100 * 60 * (GR[g] || 0) : null; }
  function procPts(g)    { return g ? 8 * (GR[g] || 0) : null; }

  // ── 集計サマリー ─────────────────────────────────────────
  function renderSummary(c) {
    const done = MEMBERS.filter(m => stateMap[m.id].kpis.every(k => k.finGrade)).length;
    const finTotals = MEMBERS.map(m => {
      const fk = calcKpi(m.id,'fin'), fp = calcProc(m.id,'fin');
      return fk !== null && fp !== null ? fk + fp : null;
    }).filter(v => v !== null);
    const avg = finTotals.length ? finTotals.reduce((a,b)=>a+b,0)/finTotals.length : null;

    c.innerHTML = '';

    // ── 全社目標バー ──
    const goalBar = el('div','corp-goal');
    goalBar.innerHTML = '<span class="corp-goal-label">全社目標</span><span class="corp-goal-val">営業利益 100,000,000円</span>';
    c.appendChild(goalBar);

    // ── MISSION ──
    const missionCard = el('div','mission-card');
    missionCard.innerHTML = `
      <div class="mission-sec-title">営業推進本部の目標・MISSION</div>
      <div class="mission-list">
        <div class="mission-item">FAN創造とLTV最大化を担い、成長事業を支えるブランド基盤を形成する</div>
        <div class="mission-item">FAN基盤の確立を通じて、他部署の展開に好影響を与える中枢機能として組織の成長を牽引する</div>
      </div>`;
    c.appendChild(missionCard);

    // ── 重点課題 ──
    const pgrid = el('div','priority-grid');
    [
      { num:'01', name:'FAN基盤の強化', sub:'CX・再来店・CRM',     tags:['FAN売上比率UP','Fan活性度UP','成長Fan数UP'] },
      { num:'02', name:'統合価値向上',  sub:'商品・体験・ブランド', tags:['営業利益UP','Fan活性度UP'] },
      { num:'03', name:'新規FAN層獲得', sub:'若年層・ファミリー',   tags:['若年比率UP','SNS起因来店'] },
    ].forEach(p => {
      const card = el('div','priority-card');
      card.innerHTML = `
        <div class="priority-num">重点課題 ${p.num}</div>
        <div class="priority-name">${p.name}</div>
        <div class="priority-sub">${p.sub}</div>
        <div class="priority-tags">${p.tags.map(t=>`<span class="priority-tag">${t}</span>`).join('')}</div>`;
      pgrid.appendChild(card);
    });
    c.appendChild(pgrid);

    const mr = el('div','metric-row');
    [{ label:'評価対象者', val:MEMBERS.length+'名' },
     { label:'期末入力完了', val:done+'名' },
     { label:'平均合計点（期末）', val:fmt(avg)+(avg!==null?' 点':'') },
     { label:'評価期間', val:'4月〜8月' },
    ].forEach(({label, val}) => {
      const d = el('div','metric');
      d.innerHTML = `<div class="metric-label">${label}</div><div class="metric-val">${val}</div>`;
      mr.appendChild(d);
    });
    c.appendChild(mr);

    const card = el('div','card');
    card.innerHTML = '<div class="card-title">全体集計</div>';
    const wrap = el('div','tbl-wrap');
    const tbl = document.createElement('table');
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    ['氏名','役職'].forEach(h => { const t=th(h,''); htr.appendChild(t); });
    [['中間<br>行動計画','mid'],['中間<br>プロセス','mid'],['中間<br>合計','mid'],
     ['期末<br>行動計画','fin'],['期末<br>プロセス','fin'],['期末<br>合計','fin']].forEach(([h,cls]) => {
      const t=document.createElement('th'); t.innerHTML=h; t.className=cls; htr.appendChild(t);
    });
    htr.appendChild(th('ランク','')); thead.appendChild(htr); tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    MEMBERS.forEach(m => {
      const mk=calcKpi(m.id,'mid'), mp=calcProc(m.id,'mid');
      const fk=calcKpi(m.id,'fin'), fp=calcProc(m.id,'fin');
      const mt=mk!==null&&mp!==null?mk+mp:null, ft=fk!==null&&fp!==null?fk+fp:null;
      const r=rank(ft);
      const tr=document.createElement('tr');
      const nameTd=document.createElement('td');
      const btn=el('button','btn-link'); btn.textContent=m.name;
      btn.onclick=()=>{currentTab=m.id;render();}; nameTd.appendChild(btn); tr.appendChild(nameTd);
      td(tr,m.title,'color:#777;font-size:13px');
      [mk,mp,mt].forEach((v,i)=>td(tr,fmt(v),'text-align:center;background:#EEF4FF'+(i===2?';font-weight:bold':'')));
      [fk,fp,ft].forEach((v,i)=>td(tr,fmt(v),'text-align:center;background:#EEF9EE'+(i===2?';font-weight:bold':'')));
      const rtd=document.createElement('td'); rtd.style.textAlign='center';
      if(r){const b=el('span','badge rank-'+r);b.textContent=r;rtd.appendChild(b);}
      tr.appendChild(rtd); tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); card.appendChild(wrap); c.appendChild(card);
    const note=el('p'); note.style.cssText='font-size:12px;color:#999;margin-top:4px';
    note.textContent='※ 各個人タブで評価を入力・保存すると自動反映されます';
    c.appendChild(note);
  }

  // ── 課題一覧（createElement統一でバグ修正）────────────────
  function renderKpiList(c) {
    c.innerHTML = '';
    const card = el('div','card');
    const cardTitle = el('div','card-title');
    cardTitle.innerHTML = '全施策 評価一覧　<span style="font-size:12px;font-weight:normal;color:#777">（各セルで評価を入力できます）</span>';
    card.appendChild(cardTitle);
    const wrap = el('div','tbl-wrap');
    const tbl = document.createElement('table');

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    [['氏名',''],['施策名',''],['ウェイト','width:70px;text-align:center'],['KPI基準',''],
     ['中間','mid'],['期末','fin']].forEach(([label, style]) => {
      const t = document.createElement('th');
      t.textContent = label;
      if (style === 'mid') t.className = 'mid';
      else if (style === 'fin') t.className = 'fin';
      else if (style) t.style.cssText = style;
      htr.appendChild(t);
    });
    thead.appendChild(htr); tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    MEMBERS.forEach(m => {
      if (!stateMap[m.id]) return;
      m.kpis.forEach((k, ki) => {
        const ks = stateMap[m.id].kpis[ki];
        if (!ks) return;
        const tr = document.createElement('tr');
        if (ki === 0) tr.className = 'tr-first';

        const nameTd = document.createElement('td');
        nameTd.style.whiteSpace = 'nowrap';
        if (ki === 0) {
          const btn = el('button','btn-link'); btn.textContent = m.name;
          btn.onclick = () => { currentTab = m.id; render(); };
          nameTd.appendChild(btn);
        }
        tr.appendChild(nameTd);

        const stTd=document.createElement('td'); stTd.textContent=k.施策; stTd.style.whiteSpace='nowrap'; tr.appendChild(stTd);
        const wtTd=document.createElement('td'); wtTd.style.textAlign='center';
        const wtTag=el('span','weight-tag'); wtTag.textContent=k.weight+'%'; wtTd.appendChild(wtTag); tr.appendChild(wtTd);
        const kTd=document.createElement('td'); kTd.className='kpi-text'; kTd.textContent=k.kpi; tr.appendChild(kTd);

        const mTd=document.createElement('td'); mTd.style.background='#EEF4FF';
        mTd.appendChild(mkGradeSelect(ks.midGrade, v=>{ks.midGrade=v;markPending(m.id);renderContent();})); tr.appendChild(mTd);
        const fTd=document.createElement('td'); fTd.style.background='#EEF9EE';
        fTd.appendChild(mkGradeSelect(ks.finGrade, v=>{ks.finGrade=v;markPending(m.id);renderContent();})); tr.appendChild(fTd);

        tbody.appendChild(tr);
      });
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); card.appendChild(wrap); c.appendChild(card);
  }

  // ── 個人シート ───────────────────────────────────────────
  function renderMember(c, m) {
    const s  = stateMap[m.id];
    const mk=calcKpi(m.id,'mid'), mp=calcProc(m.id,'mid');
    const fk=calcKpi(m.id,'fin'), fp=calcProc(m.id,'fin');
    const ft=fk!==null&&fp!==null?fk+fp:null;
    const r=rank(ft);
    c.innerHTML = '';

    const hdr = el('div','member-header');
    const av = el('div','avatar'); av.textContent = m.initials;
    const info = el('div');
    info.innerHTML = `<div style="font-size:17px;font-weight:bold">${m.name}</div>
      <div style="font-size:13px;color:#777;margin-top:2px">${m.title}</div>`;
    hdr.appendChild(av); hdr.appendChild(info);
    if (pendingSet.has(m.id)) { const pill=el('span','pending-pill');pill.textContent='未保存の変更があります';hdr.appendChild(pill); }
    c.appendChild(hdr);

    const sg = el('div','score-grid');
    [{label:'中間 行動計画（60点）',val:fmt(mk),cls:'mid-card',pct:mk?mk/60*100:0,pf:'pf-mid'},
     {label:'期末 行動計画（60点）',val:fmt(fk),cls:'fin-card',pct:fk?fk/60*100:0,pf:'pf-fin'},
     {label:'中間 プロセス（40点）',val:fmt(mp),cls:'mid-card',pct:mp?mp/40*100:0,pf:'pf-mid'},
     {label:'期末 プロセス（40点）',val:fmt(fp),cls:'fin-card',pct:fp?fp/40*100:0,pf:'pf-fin'},
     {label:'期末 合計（100点）',val:ft!==null?ft.toFixed(1):'—',cls:'total-card',pct:ft||0,pf:'pf-red',
      extra:r?`<span class="badge rank-${r}" style="margin-left:8px;font-size:14px">${r}</span>`:''},
    ].forEach(({label,val,cls,pct,pf,extra}) => {
      const sc=el('div','score-card '+cls);
      sc.innerHTML=`<div class="score-label">${label}</div><div class="score-val ${cls.replace('-card','-c')}">${val}${extra||''}</div>`;
      const prog=el('div','progress'); const fill=el('div','progress-fill '+pf);
      fill.style.width=Math.min(pct,100)+'%'; prog.appendChild(fill); sc.appendChild(prog); sg.appendChild(sc);
    });
    c.appendChild(sg);

    c.appendChild(buildKpiTable(m, s));
    c.appendChild(buildProcTable(m, s));

    const fa=el('div','footer-actions');
    const backBtn=el('button','btn-secondary'); backBtn.textContent='← サマリーへ';
    backBtn.onclick=()=>{currentTab='summary';render();};
    const saveBtn=el('button','btn-primary'); saveBtn.textContent='💾 この人を保存';
    saveBtn.onclick=()=>saveMember(m.id,saveBtn);
    fa.appendChild(backBtn); fa.appendChild(saveBtn); c.appendChild(fa);
  }

  function buildKpiTable(m, s) {
    const card=el('div','card');
    card.innerHTML='<div class="card-title">■ 行動計画評価（60点満点）</div>';
    const wrap=el('div','tbl-wrap');
    const tbl=document.createElement('table');
    const thead=document.createElement('thead'), htr=document.createElement('tr');
    [['施策名','18%',''],['ウェイト','6%',''],['KPI基準','',''],
     ['中間評価','7%','mid'],['中間点','7%','mid'],['中間コメント','15%','mid'],
     ['期末評価','7%','fin'],['期末点','7%','fin'],['期末コメント','15%','fin']].forEach(([label,w,cls])=>{
      const t=document.createElement('th'); t.textContent=label;
      if(w) t.style.width=w; if(cls) t.className=cls; htr.appendChild(t);
    });
    thead.appendChild(htr); tbl.appendChild(thead);
    const tbody=document.createElement('tbody');
    m.kpis.forEach((k,ki)=>{
      const ks=s.kpis[ki], mP=kpiPts(k,ks.midGrade), fP=kpiPts(k,ks.finGrade);
      const tr=document.createElement('tr');
      const nTd=document.createElement('td');nTd.textContent=k.施策;nTd.style.fontWeight='bold';tr.appendChild(nTd);
      const wTd=document.createElement('td');wTd.style.textAlign='center';
      const wTag=el('span','weight-tag');wTag.textContent=k.weight+'%';wTd.appendChild(wTag);tr.appendChild(wTd);
      const kTd=document.createElement('td');kTd.className='kpi-text';kTd.textContent=k.kpi;tr.appendChild(kTd);
      const mGTd=document.createElement('td');mGTd.style.cssText='background:#EEF4FF;text-align:center';
      mGTd.appendChild(mkGradeSelect(ks.midGrade,v=>{ks.midGrade=v;markPending(m.id);renderContent();}));tr.appendChild(mGTd);
      const mPTd=document.createElement('td');mPTd.textContent=mP!==null?mP.toFixed(2):'—';mPTd.style.cssText='background:#EEF4FF;text-align:center;font-weight:bold;color:#1a4070';tr.appendChild(mPTd);
      const mCTd=document.createElement('td');mCTd.style.background='#EEF4FF';mCTd.appendChild(mkCommentInput(ks.midComment,v=>{ks.midComment=v;markPending(m.id);}));tr.appendChild(mCTd);
      const fGTd=document.createElement('td');fGTd.style.cssText='background:#EEF9EE;text-align:center';
      fGTd.appendChild(mkGradeSelect(ks.finGrade,v=>{ks.finGrade=v;markPending(m.id);renderContent();}));tr.appendChild(fGTd);
      const fPTd=document.createElement('td');fPTd.textContent=fP!==null?fP.toFixed(2):'—';fPTd.style.cssText='background:#EEF9EE;text-align:center;font-weight:bold;color:#1a5a2a';tr.appendChild(fPTd);
      const fCTd=document.createElement('td');fCTd.style.background='#EEF9EE';fCTd.appendChild(mkCommentInput(ks.finComment,v=>{ks.finComment=v;markPending(m.id);}));tr.appendChild(fCTd);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); card.appendChild(wrap); return card;
  }

  function buildProcTable(m, s) {
    const card=el('div','card');
    card.innerHTML='<div class="card-title">■ プロセス評価（40点満点）― CHIBO価値観に基づく行動評価 ―</div>';
    const wrap=el('div','tbl-wrap');
    const tbl=document.createElement('table');
    const thead=document.createElement('thead'), htr=document.createElement('tr');
    [['評価観点','14%',''],['観点説明','22%',''],
     ['中間評価','7%','mid'],['中間点','7%','mid'],['中間コメント','15%','mid'],
     ['期末評価','7%','fin'],['期末点','7%','fin'],['期末コメント','15%','fin']].forEach(([label,w,cls])=>{
      const t=document.createElement('th');t.textContent=label;
      if(w)t.style.width=w;if(cls)t.className=cls;htr.appendChild(t);
    });
    thead.appendChild(htr); tbl.appendChild(thead);
    const tbody=document.createElement('tbody');
    PROC.forEach((p,pi)=>{
      const ps=s.proc[pi], mP=procPts(ps.midGrade), fP=procPts(ps.finGrade);
      const tr=document.createElement('tr');
      const oTd=document.createElement('td');oTd.textContent=p.label;oTd.style.fontWeight='bold';tr.appendChild(oTd);
      const dTd=document.createElement('td');dTd.className='kpi-text';dTd.textContent=p.desc;tr.appendChild(dTd);
      const mGTd=document.createElement('td');mGTd.style.cssText='background:#EEF4FF;text-align:center';
      mGTd.appendChild(mkGradeSelect(ps.midGrade,v=>{ps.midGrade=v;markPending(m.id);renderContent();}));tr.appendChild(mGTd);
      const mPTd=document.createElement('td');mPTd.textContent=mP!==null?mP.toFixed(2):'—';mPTd.style.cssText='background:#EEF4FF;text-align:center;font-weight:bold;color:#1a4070';tr.appendChild(mPTd);
      const mCTd=document.createElement('td');mCTd.style.background='#EEF4FF';mCTd.appendChild(mkCommentInput(ps.midComment,v=>{ps.midComment=v;markPending(m.id);}));tr.appendChild(mCTd);
      const fGTd=document.createElement('td');fGTd.style.cssText='background:#EEF9EE;text-align:center';
      fGTd.appendChild(mkGradeSelect(ps.finGrade,v=>{ps.finGrade=v;markPending(m.id);renderContent();}));tr.appendChild(fGTd);
      const fPTd=document.createElement('td');fPTd.textContent=fP!==null?fP.toFixed(2):'—';fPTd.style.cssText='background:#EEF9EE;text-align:center;font-weight:bold;color:#1a5a2a';tr.appendChild(fPTd);
      const fCTd=document.createElement('td');fCTd.style.background='#EEF9EE';fCTd.appendChild(mkCommentInput(ps.finComment,v=>{ps.finComment=v;markPending(m.id);}));tr.appendChild(fCTd);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); card.appendChild(wrap); return card;
  }

  // ── 保存 ──────────────────────────────────────────────────
  function buildPayload(mid) {
    const m=MEMBERS.find(x=>x.id===mid), s=stateMap[mid];
    const scores=[];
    m.kpis.forEach((_,ki)=>{
      const ks=s.kpis[ki];
      scores.push({phase:'mid',type:'kpi',item_index:ki,grade:ks.midGrade,comment:ks.midComment});
      scores.push({phase:'fin',type:'kpi',item_index:ki,grade:ks.finGrade,comment:ks.finComment});
    });
    PROC.forEach((_,pi)=>{
      const ps=s.proc[pi];
      scores.push({phase:'mid',type:'proc',item_index:pi,grade:ps.midGrade,comment:ps.midComment});
      scores.push({phase:'fin',type:'proc',item_index:pi,grade:ps.finGrade,comment:ps.finComment});
    });
    return {memberId:mid, scores:scores.filter(s=>s.grade||s.comment)};
  }

  async function saveMember(mid, btn) {
    if (btn){btn.disabled=true;btn.textContent='保存中…';}
    try {
      const res=await API.saveScores(buildPayload(mid));
      if(!res.ok) throw new Error(res.error);
      pendingSet.delete(mid);
      UI.toast('保存しました ✓','success'); UI.showSaved(); renderNav();
    } catch(err) { UI.toast('保存エラー: '+err.message,'error'); }
    finally { if(btn){btn.disabled=false;btn.textContent='💾 この人を保存';} }
  }

  async function globalSave() {
    if(!pendingSet.size){UI.toast('変更はありません','');return;}
    const btn=document.getElementById('globalSaveBtn');
    btn.disabled=true; btn.textContent='保存中…';
    const ids=[...pendingSet];
    try {
      await Promise.all(ids.map(mid=>API.saveScores(buildPayload(mid))));
      ids.forEach(mid=>pendingSet.delete(mid));
      UI.toast(`${ids.length}名分を保存しました ✓`,'success'); UI.showSaved(); renderNav();
    } catch(err){ UI.toast('保存エラー: '+err.message,'error'); }
    finally { btn.disabled=false; btn.textContent='💾 一括保存'; }
  }

  function markPending(mid){ pendingSet.add(mid); renderNav(); }

  // ── DOM ヘルパー ──────────────────────────────────────────
  function el(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
  function th(text,cls){const t=document.createElement('th');t.textContent=text;if(cls)t.className=cls;return t;}
  function td(tr,text,style){const t=document.createElement('td');t.textContent=text;if(style)t.style.cssText=style;tr.appendChild(t);return t;}
  function mkGradeSelect(val,onChange){
    const s=document.createElement('select');
    s.className='grade'+(val?' has-val':'');
    ['','A','B','C','D','E'].forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=g||'—';if(g===val)o.selected=true;s.appendChild(o);});
    s.addEventListener('change',()=>{s.className='grade'+(s.value?' has-val':'');onChange(s.value);});
    return s;
  }
  function mkCommentInput(val,onChange){
    const inp=document.createElement('input');
    inp.type='text';inp.className='comment';inp.value=val||'';inp.placeholder='コメント';
    inp.addEventListener('input',()=>onChange(inp.value));return inp;
  }

  // ── マスタ編集モーダル ────────────────────────────────────
  function openMasterModal(memberId) {
    const m=MEMBERS.find(x=>x.id===memberId);
    document.getElementById('modalTitle').textContent=`課題・KPI編集 ― ${m.name}`;
    const body=document.getElementById('modalBody');
    body.dataset.mid=memberId; body.innerHTML='';
    const tbl=document.createElement('table');
    tbl.style.cssText='width:100%;border-collapse:collapse;font-size:14px;margin-bottom:10px';
    const thead=document.createElement('thead'),htr=document.createElement('tr');
    [['施策名',''],['WT%','70px'],['KPI基準',''],['','40px']].forEach(([h,w])=>{
      const t=document.createElement('th');t.textContent=h;
      t.style.cssText=`text-align:left;padding:6px 8px;background:#f5f5f5;${w?'width:'+w:''}`;htr.appendChild(t);
    });
    thead.appendChild(htr);tbl.appendChild(thead);
    const tbody=document.createElement('tbody');
    m.kpis.forEach((k,ki)=>{
      const tr=document.createElement('tr');
      [[k.施策,'施策','text-inp'],[String(k.weight),'weight','num-inp'],[k.kpi,'kpi','text-inp']].forEach(([val,field,cls])=>{
        const tdEl=document.createElement('td');tdEl.style.padding='5px 6px';
        const inp=document.createElement('input');inp.type=field==='weight'?'number':'text';
        inp.className=cls;inp.value=val;inp.dataset.mid=memberId;inp.dataset.ki=ki;inp.dataset.field=field;
        if(field==='weight'){inp.min=0;inp.max=100;}
        tdEl.appendChild(inp);tr.appendChild(tdEl);
      });
      const delTd=document.createElement('td');delTd.style.cssText='padding:5px 6px;text-align:center';
      const delBtn=document.createElement('button');delBtn.textContent='削除';
      delBtn.style.cssText='background:#ffeeee;border:1px solid #ffcccc;border-radius:4px;cursor:pointer;color:#c00;padding:3px 8px;font-size:12px';
      delBtn.onclick=()=>{m.kpis.splice(ki,1);stateMap[memberId].kpis.splice(ki,1);openMasterModal(memberId);};
      delTd.appendChild(delBtn);tr.appendChild(delTd);tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);body.appendChild(tbl);
    const addBtn=document.createElement('button');addBtn.className='btn-secondary';
    addBtn.style.cssText='font-size:13px;margin-bottom:4px';addBtn.textContent='＋ 施策を追加';
    addBtn.onclick=()=>{
      m.kpis.push({施策:'新しい施策',weight:10,kpi:''});
      stateMap[memberId].kpis.push({midGrade:'',midComment:'',finGrade:'',finComment:''});
      openMasterModal(memberId);
    };
    body.appendChild(addBtn);
    document.getElementById('masterModal').classList.add('show');
  }

  function closeMasterModal(){ document.getElementById('masterModal').classList.remove('show'); }

  async function saveMasterFromModal(){
    const mid=document.getElementById('modalBody').dataset.mid;
    const m=MEMBERS.find(x=>x.id===mid);
    document.querySelectorAll(`[data-mid="${mid}"]`).forEach(inp=>{
      const ki=Number(inp.dataset.ki),field=inp.dataset.field;
      if(field==='施策')m.kpis[ki].施策=inp.value;
      if(field==='weight')m.kpis[ki].weight=Number(inp.value)||0;
      if(field==='kpi')m.kpis[ki].kpi=inp.value;
    });
    try {
      const res=await API.saveMaster({members:MEMBERS});
      if(!res.ok)throw new Error(res.error);
      UI.toast('課題マスタを保存しました ✓','success');closeMasterModal();renderContent();
    } catch(err){ UI.toast('保存エラー: '+err.message,'error'); }
  }

  return { init, globalSave, openMasterModal, closeMasterModal, saveMasterFromModal };
})();

window.addEventListener('DOMContentLoaded', () => App.init());
