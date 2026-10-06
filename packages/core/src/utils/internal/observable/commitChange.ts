import { Transaction } from "src/utils/internal/observable/Transaction";

/** Applies one change through a transaction, so every store it touches becomes visible before any listener runs. */
export const commitChange = (apply: (transaction: Transaction) => void) => {
  const transaction = new Transaction();

  apply(transaction);
  transaction.commit();
};
