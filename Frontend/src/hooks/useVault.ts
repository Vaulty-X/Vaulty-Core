import { useCallback } from 'react';
import { Vault, Deposit, Withdrawal } from '@/types';
import { useAppStore } from '@/stores';

export function useVault() {
  const vaults = useAppStore((s) => s.vaults);
  const addVault = useAppStore((s) => s.addVault);
  const updateVault = useAppStore((s) => s.updateVault);

  // Create a new vault
  const createVault = useCallback(
    async (vaultData: Omit<Vault, 'id' | 'deposits' | 'withdrawals'>) => {
      const newVault: Vault = {
        ...vaultData,
        id: crypto.randomUUID(),
        deposits: [],
        withdrawals: [],
      };
      addVault(newVault);
      return newVault;
    },
    [addVault]
  );

  // Deposit into a vault
  const depositToVault = useCallback(
    async (vaultId: string, amount: number) => {
      const vault = vaults.find((v) => v.id === vaultId);
      const currentBalance = vault?.currentBalance ?? 0;

      const newBalance = currentBalance + amount;

      const deposit: Deposit = {
        id: crypto.randomUUID(),
        vaultId,
        amount,
        timestamp: new Date(),
        transactionHash: '',
      };

      updateVault(vaultId, {
        currentBalance: newBalance,
        deposits: vault ? [...vault.deposits, deposit] : [deposit],
      });
    },
    [vaults, updateVault]
  );

  // Withdraw from a vault
  const withdrawFromVault = useCallback(
    async (vaultId: string, amount: number) => {
      const vault = vaults.find((v) => v.id === vaultId);
      if (!vault) throw new Error('Vault not found');
      if (vault.currentBalance < amount) throw new Error('Insufficient balance');

      const newBalance = vault.currentBalance - amount;

      const withdrawal: Withdrawal = {
        id: crypto.randomUUID(),
        vaultId,
        amount,
        timestamp: new Date(),
        transactionHash: '',
      };

      updateVault(vaultId, {
        currentBalance: newBalance,
        withdrawals: [...vault.withdrawals, withdrawal],
      });
    },
    [vaults, updateVault]
  );

  return {
    vaults,
    createVault,
    depositToVault,
    withdrawFromVault,
  };
}
