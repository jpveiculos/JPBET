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
  {label:"2x",type:"prize",multiplier:2,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"2x",type:"prize",multiplier:2,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"2x",type:"prize",multiplier:2,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"X",type:"zero",multiplier:0,probability:5},
  {label:"2x",type:"prize",multiplier:2,probability:5},
  {label:"",type:"zero",multiplier:0,probability:0},
  {label:"",type:"zero",multiplier:0,probability:0},
  {label:"",type:"zero",multiplier:0,probability:0},
  {label:"",type:"zero",multiplier:0,probability:0}
];

const configuracoesPadrao = [
  ["site_name","My Bets"],["site_title","My Bets - Plataforma de Jogos"],["site_description","Uma experiência de jogos moderna, rápida e pensada para dispositivos móveis."],["footer_text","© 2026 My Bets — Plataforma de demonstração."],
  ["bonus_system_enabled","true"],["initial_bonus_amount","100"],["bonus_wager_requirement","100"],
  ["notification_enabled","false"],["notification_deposit_requested","true"],["notification_withdrawal_requested","true"],["notification_deposit_approved","true"],["notification_deposit_rejected","true"],["notification_withdrawal_approved","true"],["notification_withdrawal_rejected","true"],["notification_withdrawal_completed","true"],["notification_webhook_url",""],["notification_webhook_token",""],["notification_recipient",""],
  ["roulette_enabled","true"],["roulette_min_bet","0.50"],["roulette_max_bet","100"],["roulette_rtp","50"],["roulette_replay_probability","8"],["roulette_free_spin_enabled","true"],["roulette_segments_json",JSON.stringify(segmentosRoletaPadrao)],["roulette_animation_ms","1800"],["roulette_red_color","#e51f35"],["roulette_black_color","#171717"],["roulette_green_color","#08a83e"],["roulette_accent_color","#ffd43b"],["roulette_background_color","#fff7d6"],
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
    for (const [key,value] of configuracoesPadrao) await pool.query(`INSERT INTO site_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT(setting_key) DO NOTHING`,[key,value]);

    const result = await pool.query(`SELECT setting_value FROM site_settings WHERE setting_key='roulette_segments_json' LIMIT 1`);
    const atual = String(result.rows[0]?.setting_value || "");
    if (atual.includes("JOGUE NOVAMENTE") || atual.includes('"multiplier":1')) {
      await pool.query(`UPDATE site_settings SET setting_value=$1,updated_at=CURRENT_TIMESTAMP WHERE setting_key='roulette_segments_json'`,[JSON.stringify(segmentosRoletaPadrao)]);
    } else {
      try {
        let segmentos = JSON.parse(atual);
        if (Array.isArray(segmentos) && segmentos.length === 20) {
          let mudou = false;
          segmentos = segmentos.slice(0,16).map((s,i)=>{
            if (i===10 && String(s?.type||'').toLowerCase()==='prize' && Number(s?.multiplier)===4) { mudou=true; return {...s,label:'2x',multiplier:2}; }
            return s;
          });
          while (segmentos.length<16) segmentos.push({label:'X',type:'zero',multiplier:0,probability:0});
          const internos = segmentos.slice(0,16).concat([{label:"",type:"zero",multiplier:0,probability:0},{label:"",type:"zero",multiplier:0,probability:0},{label:"",type:"zero",multiplier:0,probability:0},{label:"",type:"zero",multiplier:0,probability:0}]);
          if (mudou || JSON.stringify(internos)!==JSON.stringify(JSON.parse(atual))) await pool.query(`UPDATE site_settings SET setting_value=$1,updated_at=CURRENT_TIMESTAMP WHERE setting_key='roulette_segments_json'`,[JSON.stringify(internos)]);
        } else if (Array.isArray(segmentos) && segmentos.length === 16) {
          const internos = segmentos.concat([{label:"",type:"zero",multiplier:0,probability:0},{label:"",type:"zero",multiplier:0,probability:0},{label:"",type:"zero",multiplier:0,probability:0},{label:"",type:"zero",multiplier:0,probability:0}]);
          await pool.query(`UPDATE site_settings SET setting_value=$1,updated_at=CURRENT_TIMESTAMP WHERE setting_key='roulette_segments_json'`,[JSON.stringify(internos)]);
        }
      } catch (error) { console.warn('Migração da roleta não aplicada:',error.message); }
    }
    console.log('Configurações do My Bets inicializadas com sucesso.');
  } catch(error) { console.error('Erro ao inicializar configurações:',error); }
}
inicializarConfiguracoes();

router.get('/public',async(req,res)=>{try{const result=await pool.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key NOT LIKE 'notification_%' ORDER BY setting_key`);const settings={};for(const row of result.rows) settings[row.setting_key]=row.setting_value;res.json({ok:true,settings});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao carregar configurações públicas.'});}});

router.get('/',exigirAdmin,async(req,res)=>{try{const result=await pool.query(`SELECT setting_key,setting_value,updated_at FROM site_settings ORDER BY setting_key`);res.json({ok:true,settings:result.rows});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao carregar configurações.'});}});

router.get('/:key',exigirAdmin,async(req,res)=>{try{const result=await pool.query(`SELECT setting_key,setting_value,updated_at FROM site_settings WHERE setting_key=$1 LIMIT 1`,[req.params.key]);if(!result.rows.length)return res.status(404).json({ok:false,message:'Configuração não encontrada.'});res.json({ok:true,setting:result.rows[0]});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao buscar configuração.'});}});

router.put('/:key',exigirAdmin,async(req,res)=>{try{const {key}=req.params,{value}=req.body;if(!key||key.length>100)return res.status(400).json({ok:false,message:'Chave de configuração inválida.'});if(value===undefined||value===null)return res.status(400).json({ok:false,message:'Informe o novo valor.'});const result=await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP RETURNING setting_key,setting_value,updated_at`,[key,String(value)]);res.json({ok:true,message:'Configuração atualizada com sucesso.',setting:result.rows[0]});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao atualizar configuração.'});}});

router.put('/',exigirAdmin,async(req,res)=>{try{const settings=req.body;if(!settings||typeof settings!=='object'||Array.isArray(settings))return res.status(400).json({ok:false,message:'Formato de configurações inválido.'});const entries=Object.entries(settings);if(!entries.length)return res.status(400).json({ok:false,message:'Nenhuma configuração foi enviada.'});for(const [key,value] of entries){if(!key||key.length>100||value===undefined||value===null)continue;await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_at) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=CURRENT_TIMESTAMP`,[key,String(value)]);}res.json({ok:true,message:'Configurações atualizadas com sucesso.'});}catch(error){console.error(error);res.status(500).json({ok:false,message:'Erro ao atualizar configurações.'});}});

export default router;
