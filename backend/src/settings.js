import express from "express";
import { pool } from "./db.js";
import { validarSessaoAdmin } from "./adminSession.js";

const router = express.Router();

function exigirAdmin(req, res, next) {
  const cookies = {};
  (req.headers.cookie || "").split(";").forEach((cookie) => {
    const partes = cookie.trim().split("=");
    if (partes.length < 2) return;
    const nome = partes.shift().trim();
    const valor = partes.join("=").trim();
    try { cookies[nome] = decodeURIComponent(valor); } catch { cookies[nome] = valor; }
  });
  const sessao = validarSessaoAdmin(cookies.jpbet_admin_session || null);
  if (!sessao) return res.status(401).json({ ok:false, message:"Acesso administrativo necessário." });
  req.admin = sessao;
  next();
}

const segmentosRoletaPadrao = [
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"5x","type":"prize","multiplier":5,"probability":15},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"10x","type":"prize","multiplier":10,"probability":15},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"2x","type":"prize","multiplier":2,"probability":15},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"","type":"zero","multiplier":0,"probability":5},
  {"label":"3x","type":"prize","multiplier":3,"probability":15},
  {"label":"","type":"zero","multiplier":0,"probability":5}
];

const configuracoesPadrao = [
  ["site_name","My Bets"],["site_title","My Bets - Plataforma de Jogos"],["site_description","Uma experiência de jogos moderna, rápida e pensada para dispositivos móveis."],["footer_text","© 2026 My Bets — Plataforma de demonstração."],
  ["bonus_system_enabled","true"],["initial_bonus_amount","100"],["bonus_wager_requirement","100"],
  ["notification_enabled","false"],["notification_deposit_requested","true"],["notification_withdrawal_requested","true"],["notification_deposit_approved","true"],["notification_deposit_rejected","true"],["notification_withdrawal_approved","true"],["notification_withdrawal_rejected","true"],["notification_withdrawal_completed","true"],["notification_webhook_url",""],["notification_webhook_token",""],["notification_recipient",""],
  ["roulette_enabled","true"],["roulette_min_bet","0.50"],["roulette_max_bet","100"],["roulette_segments_json",JSON.stringify(segmentosRoletaPadrao)],["roulette_animation_ms","1800"],["roulette_red_color","#e51f35"],["roulette_black_color","#171717"],["roulette_green_color","#08a83e"],["roulette_accent_color","#ffd43b"],["roulette_background_color","#fff7d6"],["roulette_prize_color","#d4af37"],["roulette_loss_color","#171717"],["roulette_text_color","#25e66b"],["roulette_divider_color","#ffdd69"],["roulette_pointer_color","#ffd24a"],
  ["dashboard_background","#f5f7ff"],["dashboard_card_color","#ffffff"],["dashboard_primary_color","#ffcc00"],["dashboard_secondary_color","#6c3cff"],["dashboard_text_color","#171717"],
  ["primary_button_text","ENTRAR NA PLATAFORMA"],["login_button_text","ENTRAR"],["register_button_text","CRIAR CONTA"],["roulette_button_text","🎰 JOGAR NA ROLETA"],
  ["maintenance_mode","false"],["maintenance_message","Plataforma temporariamente em manutenção."],
  ["dashboard_welcome_text","Bem-vindo à plataforma My Bets."],["balance_title","Seu saldo"],["account_title","Minha conta"],["logout_button_text","SAIR DA CONTA"],["deposit_button_text","💰 DEPOSITAR"],["withdraw_button_text","💸 SACAR"],["history_button_text","📋 HISTÓRICO"],
  ["virtual_credits_mode","true"],["virtual_credits_text","Esta plataforma utiliza créditos virtuais para demonstração."],["virtual_credits_disclaimer","Os créditos desta versão não representam dinheiro real."],["virtual_credits_notice","🎮 Esta versão utiliza exclusivamente créditos virtuais para demonstração. Os créditos não representam dinheiro real."],
  ["pix_enabled","true"],["pix_key","38135fb2-dd1f-44aa-ab51-d2670ee36c7d"],["pix_key_type","aleatoria"],["pix_receiver_name","João Paulo da Silva"],["pix_city","Paramirim"],["pix_description","My Bets"],["pix_instructions","Após realizar o Pix, clique em JÁ FIZ O PIX. O crédito será liberado somente após a conferência do administrador."]
];

async function inicializarConfiguracoes() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (id SERIAL PRIMARY KEY, setting_key VARCHAR(100) UNIQUE NOT NULL, setting_value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    for (const [key,value] of configuracoesPadrao) {
      await pool.query(`INSERT INTO site_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT(setting_key) DO NOTHING`,[key,value]);
    }
  } catch(error) {
    console.error('Erro ao inicializar configurações:',error);
  }
  console.log('Configurações do My Bets inicializadas com sucesso.');
}
inicializarConfiguracoes();

router.get('/public',async(req,res)=>{try{const result=await pool.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key NOT LIKE 'notification_%' ORDER BY setting_key`);const settings={};for(const row of result.rows) settings[row.setting_key]=row.setting_value;res.json({ok:true,settings});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao carregar configurações públicas.'});}});

router.get('/',exigirAdmin,async(req,res)=>{try{const result=await pool.query(`SELECT setting_key,setting_value,updated_at FROM site_settings ORDER BY setting_key`);res.json({ok:true,settings:result.rows});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao carregar configurações.'});}});

router.get('/roulette', exigirAdmin, async (req,res) => {
  try {
    const result = await pool.query(`SELECT setting_value,updated_at FROM site_settings WHERE setting_key='roulette_segments_json' LIMIT 1`);
    let segments;
    try { segments = JSON.parse(result.rows[0]?.setting_value || ''); } catch (_) { segments = null; }
    if (!Array.isArray(segments) || segments.length !== 16) segments = segmentosRoletaPadrao;
    res.json({ok:true,segments,updated_at:result.rows[0]?.updated_at || null});
  } catch(error) {
    console.error(error);
    res.status(500).json({ok:false,message:'Erro ao carregar a configuração da roleta.'});
  }
});

router.put('/roulette', exigirAdmin, async (req,res) => {
  try {
    const segments = req.body?.segments;
    if (!Array.isArray(segments) || segments.length !== 16) return res.status(400).json({ok:false,message:'A roleta precisa ter exatamente 16 fatias.'});
    const normalized = segments.map((item,index) => {
      const type = String(item?.type || 'zero').toLowerCase();
      const multiplier = Number(item?.multiplier ?? 0);
      const probability = Number(item?.probability ?? 0);
      let label = String(item?.label ?? '').trim();
      if (type === 'zero') { label = '❌'; }
      if (type === 'prize') { if (!Number.isFinite(multiplier) || multiplier < 2 || multiplier > 100) throw new Error(`Multiplicador inválido na fatia ${index + 1}.`); label = `${Math.round(multiplier)}x`; }
      if (!['zero','prize'].includes(type)) throw new Error(`Tipo inválido na fatia ${index + 1}.`);
      if (!Number.isFinite(probability) || probability < 0) throw new Error(`Probabilidade inválida na fatia ${index + 1}.`);
      return {label,type,multiplier:type === 'prize' ? Math.round(multiplier) : 0,probability};
    });
    const total = normalized.reduce((sum,item)=>sum+item.probability,0);
    if (!(total > 0)) return res.status(400).json({ok:false,message:'A soma das probabilidades deve ser maior que zero.'});
    const result = await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES('roulette_segments_json',$1,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP RETURNING setting_value,updated_at`,[JSON.stringify(normalized)]);
    res.json({ok:true,message:'Roleta salva com sucesso.',segments:normalized,updated_at:result.rows[0].updated_at});
  } catch(error) {
    console.error(error);
    res.status(400).json({ok:false,message:error.message || 'Erro ao salvar a configuração da roleta.'});
  }
});

router.post('/roulette-large/spin', async (req,res) => {
  const client = await pool.connect();
  try {
    const rouletteId = String(req.body?.rouletteId || '').toLowerCase();
    const userId = Number(req.body?.userId);
    const betAmount = Number(req.body?.betAmount);
    const configs = {
      roleta40: { slices: 40, bet: 10, prizes: [100,200,300,400], prizeIndexes: [0,10,20,30] },
      roleta60: { slices: 60, bet: 20, prizes: [200,400,600,800], prizeIndexes: [0,15,30,45] }
    };
    const cfg = configs[rouletteId];
    if (!cfg) return res.status(400).json({ok:false,message:'Roleta inválida.'});
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ok:false,message:'Usuário inválido.'});
    if (!Number.isFinite(betAmount) || Math.abs(betAmount - cfg.bet) > 0.001) return res.status(400).json({ok:false,message:`A aposta nesta roleta é fixa em R$ ${cfg.bet.toFixed(2).replace('.',',')}.`});

    await client.query('BEGIN');
    const userResult = await client.query(`SELECT id,username,balance,bonus_balance,cash_balance,bonus_wager_progress,reserved_balance FROM users WHERE id=$1 FOR UPDATE`,[userId]);
    if (!userResult.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ok:false,message:'Usuário não encontrado.'}); }
    const user = userResult.rows[0];
    const bonus = Math.max(0,Number(user.bonus_balance||0));
    const cash = Math.max(0,Number(user.cash_balance||0));
    const available = Number((bonus+cash).toFixed(2));
    if (available < cfg.bet) { await client.query('ROLLBACK'); return res.status(400).json({ok:false,message:'Saldo disponível insuficiente.',balance:Number(user.balance||0),reservedBalance:Number(user.reserved_balance||0)}); }

    const index = Math.floor(Math.random()*cfg.slices);
    const prizePos = cfg.prizeIndexes.indexOf(index);
    const prize = prizePos >= 0 ? cfg.prizes[prizePos] : 0;
    const bonusUsed = Math.min(bonus,cfg.bet);
    const cashUsed = cfg.bet - bonusUsed;
    const newBonus = Number((bonus-bonusUsed).toFixed(2));
    const newCash = Number((cash-cashUsed+prize).toFixed(2));
    const newBalance = Number((newBonus+newCash).toFixed(2));
    const requirement = Number(await (async()=>{try{const r=await client.query(`SELECT setting_value FROM site_settings WHERE setting_key='bonus_wager_requirement' LIMIT 1`);return r.rows[0]?.setting_value||'100';}catch{return '100';}})()) || 100;
    const newProgress = Number(Math.min(requirement,Number(user.bonus_wager_progress||0)+bonusUsed).toFixed(2));

    await client.query(`UPDATE users SET balance=$1,bonus_balance=$2,cash_balance=$3,bonus_wager_progress=$4 WHERE id=$5`,[newBalance,newBonus,newCash,newProgress,userId]);
    const resultText = `${index}:${prize > 0 ? `R$ ${prize.toFixed(2)}` : 'PERCA'}:${prize > 0 ? 'prize' : 'loss'}`;
    const spinResult = await client.query(`INSERT INTO spins(user_id,result,amount) VALUES($1,$2,$3) RETURNING id,created_at`,[userId,resultText,prize]);
    await client.query(`INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)`,[userId,prize>0?'roulette_fixed_prize_win':'roulette_fixed_bet',prize>0?prize:-cfg.bet]);
    await client.query('COMMIT');

    return res.json({ok:true,spin:{id:spinResult.rows[0].id,rouletteId,index,result:prize>0?`R$ ${prize.toFixed(2)}`:'PERCA',resultType:prize>0?'prize':'loss',prize,betAmount:cfg.bet,slices:cfg.slices,prizeIndex:prizePos,prizeIndexes:cfg.prizeIndexes},user:{id:user.id,username:user.username,balance:newBalance,bonusBalance:newBonus,cashBalance:newCash,bonusWagerProgress:newProgress,bonusWagerRequirement:requirement,reservedBalance:Number(user.reserved_balance||0)}});
  } catch(error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Erro na roleta fixa:',error);
    return res.status(500).json({ok:false,message:'Erro interno ao executar a roleta.'});
  } finally { client.release(); }
});

router.get('/:key',exigirAdmin,async(req,res)=>{try{const result=await pool.query(`SELECT setting_key,setting_value,updated_at FROM site_settings WHERE setting_key=$1 LIMIT 1`,[req.params.key]);if(!result.rows.length)return res.status(404).json({ok:false,message:'Configuração não encontrada.'});res.json({ok:true,setting:result.rows[0]});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao buscar configuração.'});}});

router.put('/:key',exigirAdmin,async(req,res)=>{try{const {key}=req.params,{value}=req.body;if(!key||key.length>100)return res.status(400).json({ok:false,message:'Chave de configuração inválida.'});if(value===undefined||value===null)return res.status(400).json({ok:false,message:'Informe o novo valor.'});const result=await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP RETURNING setting_key,setting_value,updated_at`,[key,String(value)]);res.json({ok:true,message:'Configuração atualizada com sucesso.',setting:result.rows[0]});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao atualizar configuração.'});}});

router.put('/',exigirAdmin,async(req,res)=>{try{const settings=req.body;if(!settings||typeof settings!=='object'||Array.isArray(settings))return res.status(400).json({ok:false,message:'Formato de configurações inválido.'});const entries=Object.entries(settings);if(!entries.length)return res.status(400).json({ok:false,message:'Nenhuma configuração foi enviada.'});for(const [key,value] of entries){if(!key||key.length>100||value===undefined||value===null)continue;await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP`,[key,String(value)]);}res.json({ok:true,message:'Configurações atualizadas com sucesso.'});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao atualizar configurações.'});}});

export default router;