(()=>{
  const user=localStorage.getItem('jpbet_user');
  if(user)return;
  const params=new URLSearchParams(location.search);
  const game=params.get('game');
  const destino=game?`/?login=1&game=${encodeURIComponent(game)}`:'/?login=1';
  location.replace(destino);
})();
