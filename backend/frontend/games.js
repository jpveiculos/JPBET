function getBalance(user = currentUser) {
  if (!user) return 0;

  const bonus = Number(user.bonus_balance);
  const cash = Number(user.cash_balance);

  if (
    Number.isFinite(bonus) ||
    Number.isFinite(cash)
  ) {
    return (
      (Number.isFinite(bonus) ? bonus : 0) +
      (Number.isFinite(cash) ? cash : 0)
    );
  }

  const values = [
    user.balance,
    user.saldo,
    user.cash
  ];

  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}
