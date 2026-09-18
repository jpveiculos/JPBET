import express from "express";
import { randomInt } from "crypto";
import { pool } from "./db.js";

const router = express.Router();

const TOTAL_SECTORS = 54;
const LOSS_SECTORS = 45;
const DEFAULT_PRIZES = [2,3,4,5,2,3,4,5,10];
const PRIZE_INDEXES = [0,6,12,18,24,30,36,42,48];
const DEFAULT_MIN_BET = 0.50;
const DEFAULT_MAX_BET = 100.00;

// Pesos do sorteio: os oito primeiros prêmios mantêm 1/54 cada;
// o último prêmio (10x) recebe um peso ligeiramente menor.
// 2700 unidades: 8 x 50 para os demais prêmios + 49 para o 10x.
const DRAW_DENOMINATOR = 2700;
const STANDARD_PRIZE_WEIGHT = 50;
const TEN_PRIZE_WEIGHT = 49;
const TOTAL_PRIZE_WEIGHT = (PRIZE_INDEXES.length - 1) * STANDARD_PRIZE_WEIGHT + TEN_PRIZE_WEIGHT;
const LOSS_INDEXES = Array.from({length:TOTAL_SECTORS},(_,i)=>i).filter(i=>!PRIZE_INDEXES.includes(i));

async function getSetting(key,fallback){
  try{
    const r=await pool.query(`SELECT setting_value FROM site_settings WHERE setting_key=$1 LIMIT 1`,[key]);
    return r.rows[0]?.setting_value ?? fallback;
  }catch(_){
    return fallback;
  }
}

async function getConfig(){
  let prizes=[...DEFAULT_PRIZES];
  let minBet=DEFAULT_MIN_BET;
  let maxBet=DEFAULT_MAX_BET;
  try{
    const raw=await getSetting("roulette207_prizes",JSON.stringify(DEFAULT_PRIZES));
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed)&&parsed.length===9&&parsed.every(x=>Number.isFinite(Number(x))&&Number(x)>0)){
      prizes=parsed.map(Number);
    }
  }catch(_){ }
  const configuredMin=Number(await getSetting("roulette207_min_bet",String(DEFAULT_MIN_BET)));
  if(Number.isFinite(configuredMin)&&configuredMin>=DEFAULT_MIN_BET) minBet=Number(configuredMin.toFixed(2));
  const configuredMax=Number(await getSetting("roulette207_max_bet",String(DEFAULT_MAX_BET)));
  if(Number.isFinite(configuredMax)&&configuredMax>=DEFAULT_MIN_BET) maxBet=Number(configuredMax.toFixed(2));
  if(maxBet<minBet) maxBet=minBet;
  return {prizes,minBet,maxBet};
}

function sortearSetor(){
  const draw=randomInt(DRAW_DENOMINATOR);
  if(draw<TOTAL_PRIZE_WEIGHT){
    if(draw<(PRIZE_INDEXES.length-1)*STANDARD_PRIZE_WEIGHT){
      const prizePosition=Math.floor(draw/STANDARD_PRIZE_WEIGHT);
      return PRIZE_INDEXES[prizePosition];
    }
    return PRIZE_INDEXES[PRIZE_INDEXES.length-1];
  }
  return LOSS_INDEXES[randomInt(LOSS_INDEXES.length)];
}

router.get("/config",async(req,res)=>{
  const {prizes,minBet,maxBet}=await getConfig();
  res.json({ok:true,roulette:{id:"roulette90",minBet,maxBet,totalSectors:TOTAL_SECTORS,prizeSectors:prizes.length,lossSectors:LOSS_SECTORS,probabilityPercent:Number((100/TOTAL_SECTORS).toFixed(6)),totalPrizeProbabilityPercent:Number(((TOTAL_PRIZE_WEIGHT/DRAW_DENOMINATOR)*100).toFixed(6)),prizes:prizes.map((multiplier,position)=>({position,multiplier,sector:PRIZE_INDEXES[position],probabilityPercent:Number(((position===prizes.length-1?TEN_PRIZE_WEIGHT:STANDARD_PRIZE_WEIGHT)/DRAW_DENOMINATOR*100).toFixed(6))}))}});
});

/*
 * LABORATÓRIO ISOLADO
 *
 * Usa exatamente o mesmo sortearSetor() ponderado da roleta real,
 * mas NÃO consulta usuário, NÃO movimenta saldo,
 * NÃO cria spin e NÃO cria transação.
 *
 * Limite de 50.000 sorteios por requisição para evitar
 * consumo excessivo de CPU no servidor.
 */
router.post("/test-spin-batch",async(req,res)=>{
  try{
    const requested=Number(req.body?.count ?? 100);
    if(!Number.isInteger(requested)||requested<1||requested>50000){
      return res.status(400).json({ok:false,message:"A quantidade deve ser um número inteiro entre 1 e 50.000."});
    }

    const {prizes}=await getConfig();
    const countsBySector=new Array(TOTAL_SECTORS).fill(0);
    const countsByPrize=new Array(prizes.length).fill(0);
    let losses=0;

    for(let i=0;i<requested;i++){
      const sector=sortearSetor();
      countsBySector[sector]++;
      const prizePosition=PRIZE_INDEXES.indexOf(sector);
      if(prizePosition>=0) countsByPrize[prizePosition]++;
      else losses++;
    }

    const prizeCount=requested-losses;

    return res.json({
      ok:true,
      test:{
        count:requested,
        totalSectors:TOTAL_SECTORS,
        lossSectors:LOSS_SECTORS,
        prizeSectors:PRIZE_INDEXES,
        prizes,
        losses,
        prizeCount,
        countsBySector,
        countsByPrize,
        probabilityPerSectorPercent:Number((100/TOTAL_SECTORS).toFixed(6)),
        totalPrizeProbabilityPercent:Number(((TOTAL_PRIZE_WEIGHT/DRAW_DENOMINATOR)*100).toFixed(6)),
        tenMultiplierProbabilityPercent:Number((TEN_PRIZE_WEIGHT/DRAW_DENOMINATOR*100).toFixed(6)),
        standardPrizeProbabilityPercent:Number((STANDARD_PRIZE_WEIGHT/DRAW_DENOMINATOR*100).toFixed(6))
      }
    });
  }catch(error){
    console.error("Erro no teste isolado da Roleta:",error);
    return res.status(500).json({ok:false,message:"Erro interno no teste da roleta."});
  }
});

router.post("/spin",async(req,res)=>{
  const client=await pool.connect();
  try{
    const userId=Number(req.body?.userId);
    const betAmount=Number(req.body?.betAmount);
    const {prizes,minBet,maxBet}=await getConfig();

    if(!Number.isInteger(userId)||userId<=0)return res.status(400).json({ok:false,message:"Usuário inválido."});
    if(!Number.isFinite(betAmount))return res.status(400).json({ok:false,message:"Informe um valor de aposta válido."});
    if(betAmount<minBet)return res.status(400).json({ok:false,message:`A aposta mínima é R$ ${minBet.toFixed(2).replace(".",",")}.`});
    if(betAmount>maxBet)return res.status(400).json({ok:false,message:`A aposta máxima é R$ ${maxBet.toFixed(2).replace(".",",")}.`});

    const bet=Number(betAmount.toFixed(2));
    await client.query("BEGIN");

    const userResult=await client.query(`SELECT id,username,balance,bonus_balance,cash_balance,bonus_wager_progress,reserved_balance FROM users WHERE id=$1 FOR UPDATE`,[userId]);
    if(!userResult.rows.length){await client.query("ROLLBACK");return res.status(404).json({ok:false,message:"Usuário não encontrado."});}

    const user=userResult.rows[0];
    const bonus=Math.max(0,Number(user.bonus_balance||0));
    const cash=Math.max(0,Number(user.cash_balance||0));
    const available=Number((bonus+cash).toFixed(2));

    if(available<bet){
      await client.query("ROLLBACK");
      return res.status(400).json({ok:false,message:"Saldo disponível insuficiente.",balance:Number(user.balance||0),reservedBalance:Number(user.reserved_balance||0)});
    }

    const sector=sortearSetor();
    const prizePosition=PRIZE_INDEXES.indexOf(sector);
    const multiplier=prizePosition>=0?prizes[prizePosition]:0;
    const prize=multiplier>0?Number((bet*multiplier).toFixed(2)):0;

    const bonusUsed=Math.min(bonus,bet);
    const cashUsed=bet-bonusUsed;
    const newBonus=Number((bonus-bonusUsed).toFixed(2));
    const newCash=Number((cash-cashUsed+prize).toFixed(2));
    const newBalance=Number((newBonus+newCash).toFixed(2));

    const requirement=Number(await getSetting("bonus_wager_requirement","100"))||100;
    const newProgress=Number(Math.min(requirement,Number(user.bonus_wager_progress||0)+bonusUsed).toFixed(2));
    const netResult=Number((prize-bet).toFixed(2));

    await client.query(`UPDATE users SET balance=$1,bonus_balance=$2,cash_balance=$3,bonus_wager_progress=$4 WHERE id=$5`,[newBalance,newBonus,newCash,newProgress,userId]);

    const resultText=`${sector}:${multiplier>0?`${multiplier}x`:"PERCA"}:${multiplier>0?"prize":"loss"}`;
    const spinResult=await client.query(`INSERT INTO spins(user_id,result,amount) VALUES($1,$2,$3) RETURNING id,created_at`,[userId,resultText,netResult]);
    await client.query(`INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)`,[userId,multiplier>0?"roulette207_prize_win":"roulette207_bet",netResult]);
    await client.query("COMMIT");

    return res.json({ok:true,spin:{id:spinResult.rows[0].id,rouletteId:"roulette90",sector,resultType:multiplier>0?"prize":"loss",multiplier,prize,netResult,betAmount:bet,totalSectors:TOTAL_SECTORS,prizeSectors:PRIZE_INDEXES,prizes},user:{id:user.id,username:user.username,balance:newBalance,bonusBalance:newBonus,cashBalance:newCash,bonusWagerProgress:newProgress,bonusWagerRequirement:requirement,reservedBalance:Number(user.reserved_balance||0)}});
  }catch(error){
    try{await client.query("ROLLBACK")}catch(_){ }
    console.error("Erro na Roleta:",error);
    return res.status(500).json({ok:false,message:"Erro interno ao executar a Roleta."});
  }finally{
    client.release();
  }
});

export default router;
