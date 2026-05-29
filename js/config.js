const CONFIG = {
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbxAnrLPK-isivzQQiBbTvQxM-LMjSWw0a0J0D-aLLBcZaCGTHYRMZuP54voQp-pymj5/exec',

  GRADE_RATIO: { A: 1, B: 5/6, C: 4/6, D: 3/6, E: 2/6 },

  PROC_ITEMS: [
    { key: 'integrity', label: '誠実さ・信頼',     desc: '約束を守る、正直に伝える、責任ある行動' },
    { key: 'challenge', label: '挑戦・成長',        desc: '現状に満足せず、新しいことに積極的に取り組む' },
    { key: 'team',      label: '協働・チームワーク', desc: '周囲と連携し、チームの成果に貢献する' },
    { key: 'customer',  label: '顧客視点',          desc: 'FAN創造のために顧客目線で考え行動する' },
    { key: 'autonomy',  label: '自律・主体性',      desc: '指示待ちでなく、自ら考え行動し課題解決する' },
  ],
};
