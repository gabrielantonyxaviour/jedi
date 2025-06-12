import { useCardanoWallet } from "@/hooks/use-cardano-wallet";

export const CardanoWallet = () => {
  const {
    availableWallets,
    connectedWallet,
    address,
    balance,
    connect,
    disconnect,
    isConnected,
  } = useCardanoWallet();

  if (isConnected) {
    return (
      <div>
        <p>Connected: {connectedWallet}</p>
        <p>Address: {address?.slice(0, 20)}...</p>
        <p>Balance: {balance}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      <h3>Connect Cardano Wallet</h3>
      {availableWallets.map((wallet) => (
        <button key={wallet} onClick={() => connect(wallet)}>
          Connect {wallet}
        </button>
      ))}
      {availableWallets.length === 0 && (
        <p>No Cardano wallets detected. Install Nami, Eternl, or Flint.</p>
      )}
    </div>
  );
};
