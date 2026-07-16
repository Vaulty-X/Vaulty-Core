import { renderHook, act } from '@testing-library/react'
import { useVault } from '../useVault'
import { useAppStore } from '@/stores'
import { Vault } from '@/types'

// Stable UUID for deterministic tests
const MOCK_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// Mock crypto.randomUUID to return predictable IDs
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: jest.fn(() => MOCK_UUID) },
  writable: true,
})

const makeVault = (overrides: Partial<Vault> = {}): Vault => ({
  id: 'vault-1',
  name: 'Emergency Fund',
  targetAmount: 1000,
  currentBalance: 500,
  lockPeriod: 30,
  createdAt: new Date('2026-01-01'),
  maturityDate: new Date('2026-02-01'),
  deposits: [],
  withdrawals: [],
  ...overrides,
})

describe('useVault', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAppStore.setState({ vaults: [] })
  })

  it('returns empty vaults list initially', () => {
    const { result } = renderHook(() => useVault())
    expect(result.current.vaults).toEqual([])
  })

  it('createVault adds a vault to state with generated id', async () => {
    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.createVault({
        name: 'School Fees',
        targetAmount: 2000,
        currentBalance: 0,
        lockPeriod: 90,
        createdAt: new Date('2026-07-01'),
        maturityDate: new Date('2026-09-30'),
      })
    })

    expect(result.current.vaults).toHaveLength(1)
    expect(result.current.vaults[0].id).toBe(MOCK_UUID)
    expect(result.current.vaults[0].name).toBe('School Fees')
    expect(result.current.vaults[0].deposits).toEqual([])
    expect(result.current.vaults[0].withdrawals).toEqual([])
  })

  it('createVault returns the new vault', async () => {
    const { result } = renderHook(() => useVault())
    let created: Vault | undefined

    await act(async () => {
      created = await result.current.createVault({
        name: 'Vacation',
        targetAmount: 500,
        currentBalance: 0,
        lockPeriod: 60,
        createdAt: new Date(),
        maturityDate: new Date(),
      })
    })

    expect(created).toBeDefined()
    expect(created?.id).toBe(MOCK_UUID)
    expect(created?.name).toBe('Vacation')
  })

  it('depositToVault increases the vault balance', async () => {
    useAppStore.setState({ vaults: [makeVault({ id: 'vault-1', currentBalance: 100 })] })

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.depositToVault('vault-1', 250)
    })

    expect(result.current.vaults[0].currentBalance).toBe(350)
  })

  it('depositToVault does nothing when vault id is not found', async () => {
    useAppStore.setState({ vaults: [makeVault({ id: 'vault-1', currentBalance: 100 })] })

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.depositToVault('non-existent', 100)
    })

    // Balance unchanged — vault not found, so balance defaults to 0 + 100 but vault-1 stays at 100
    expect(result.current.vaults[0].currentBalance).toBe(100)
  })

  it('withdrawFromVault decreases the vault balance', async () => {
    useAppStore.setState({ vaults: [makeVault({ id: 'vault-1', currentBalance: 500 })] })

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.withdrawFromVault('vault-1', 200)
    })

    expect(result.current.vaults[0].currentBalance).toBe(300)
  })

  it('withdrawFromVault does not go below zero (insufficient balance)', async () => {
    useAppStore.setState({ vaults: [makeVault({ id: 'vault-1', currentBalance: 100 })] })

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.withdrawFromVault('vault-1', 500)
    })

    // Balance should remain unchanged — guard prevents over-withdrawal
    expect(result.current.vaults[0].currentBalance).toBe(100)
  })

  it('withdrawFromVault allows exact full withdrawal', async () => {
    useAppStore.setState({ vaults: [makeVault({ id: 'vault-1', currentBalance: 300 })] })

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.withdrawFromVault('vault-1', 300)
    })

    expect(result.current.vaults[0].currentBalance).toBe(0)
  })

  it('reflects multiple vaults independently', async () => {
    useAppStore.setState({
      vaults: [
        makeVault({ id: 'vault-1', name: 'Emergency', currentBalance: 200 }),
        makeVault({ id: 'vault-2', name: 'Rent', currentBalance: 800 }),
      ],
    })

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await result.current.depositToVault('vault-2', 100)
    })

    expect(result.current.vaults.find((v) => v.id === 'vault-1')?.currentBalance).toBe(200)
    expect(result.current.vaults.find((v) => v.id === 'vault-2')?.currentBalance).toBe(900)
  })
})
