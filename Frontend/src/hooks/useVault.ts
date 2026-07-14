import { useAppStore } from '@/stores'
import { Vault } from '@/types'

export function useVault() {
  const { vaults, setVaults, addVault, updateVault } = useAppStore()
  
  const createVault = async (vaultData: Omit<Vault, 'id' | 'deposits' | 'withdrawals'>) => {
    // This will call the Soroban contract to create a vault
    // For now, just add to local state
    const newVault: Vault = {
      ...vaultData,
      id: crypto.randomUUID(),
      deposits: [],
      withdrawals: [],
    }
    
    addVault(newVault)
    return newVault
  }
  
  const depositToVault = async (vaultId: string, amount: number) => {
    // This will trigger a wallet-signed transaction to deposit to the vault
    // For now, just update local state
    updateVault(vaultId, {
      currentBalance: (vaults.find(v => v.id === vaultId)?.currentBalance || 0) + amount,
    })
  }
  
  const withdrawFromVault = async (vaultId: string, amount: number) => {
    // This will trigger a wallet-signed transaction to withdraw from the vault
    // For now, just update local state
    const vault = vaults.find(v => v.id === vaultId)
    if (vault && vault.currentBalance >= amount) {
      updateVault(vaultId, {
        currentBalance: vault.currentBalance - amount,
      })
    }
  }
  
  return {
    vaults,
    createVault,
    depositToVault,
    withdrawFromVault,
  }
}
