// ============================================================
// api.js  ― GAS API との通信レイヤー
// ============================================================

const API = (() => {
  const URL = CONFIG.GAS_API_URL;

  async function get(action) {
    const res = await fetch(`${URL}?action=${action}`, {
      method: 'GET',
      redirect: 'follow',   // GAS は 302 リダイレクトする
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function post(action, payload) {
    const res = await fetch(URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, // GAS は application/json だと preflight が飛ぶ
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return {
    getMaster:    () => get('getMaster'),
    getAllScores: () => get('getAllScores'),
    saveScores:   (payload) => post('saveScores', payload),
    saveMaster:   (payload) => post('saveMaster', payload),
  };
})();
