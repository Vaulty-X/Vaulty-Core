'use client'

import { useState } from 'react';
import { useVault } from '@hooks/useVault';
import { useWallet } from '@hooks/useWallet';
import { usePaymentStatus } from '@hooks/usePaymentStatus';
import { VaultList } from '@features/vaults';
import { VaultDetail } from '@features/vaults';
import { CreateVault } from '@features/vaults';
import { Vault } from '@types';

type ViewState = 
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'detail'; vault: Vault };

export default function Home() {
  const { vaults } = useVault();
  const { fundingOrders, withdrawalOrders } = usePaymentStatus();
  const { wallet } = useWallet();

  const [view, setView] = useState<ViewState>({ type: 'list' });

  const activeOrders = [...fundingOrders, ...withdrawalOrders].filter(
    (o) => o.status === 'completed' && o.status !== 'failed' && o.status !== 'expired'
  );

  const firstVaultId = vaults[0]?.id;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Vaulty</h1>
      
      {/* Navigation */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView({ type: 'list' })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Vaults
        </button>
        <button
          onClick={() => setView({ type: 'create' })}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Create Vault
        </button>
        {firstVaultId && (
          <button
            onClick={() => setView({ type: 'detail', vault: vaults[0] })}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            View Detail
          </button>
        )}
      </div>

      {/* Render Views */}
      {view.type === 'list' && <VaultList />}
      {view.type === 'create' && <CreateVault />}
      {view.type === 'detail' && view.vault && <VaultDetail vaultId={view.vault.id} />}
    </div>
  );
}