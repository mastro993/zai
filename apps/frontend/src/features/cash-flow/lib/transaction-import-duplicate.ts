export interface ImportDuplicateCandidate {
  transactionDate: string;
  amount: number;
  description: string | null;
}

export const transactionDuplicateKey = (
  transactionDate: string,
  amount: number,
  description: string,
) => `${transactionDate.slice(0, 10)}\u0000${amount}\u0000${description.trim().toLowerCase()}`;
