import { Transaction } from "src/utils/internal/observable/Transaction";

/**
 * Applies one change through a transaction, so every store it touches becomes
 * visible before any listener runs. A change that throws has still set the
 * stores it reached, and a store that holds a value its listeners were never
 * told of would be a lie, so they are told and the error goes on.
 */
export const commitChange = (apply: (transaction: Transaction) => void) => {
  const transaction = new Transaction();

  try {
    apply(transaction);
  } finally {
    transaction.commit();
  }
};
