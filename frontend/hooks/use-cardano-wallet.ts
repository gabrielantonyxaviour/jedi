// hooks/useCardanoWallet.ts
import { useState, useEffect } from "react";
import {
  Address,
  TransactionBuilder,
  TransactionBuilderConfigBuilder,
  LinearFee,
  BigNum,
  TransactionOutput,
  TransactionUnspentOutput,
  TransactionWitnessSet,
  Transaction,
  Value,
} from "@emurgo/cardano-serialization-lib-browser";
import { useAppStore } from "@/store/app-store";

export const useCardanoWallet = () => {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const { setAddress, setBalance, setWalletStatus } = useAppStore();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const wallets = [];
      if (window.cardano?.yoroi) wallets.push("yoroi");
      setAvailableWallets(wallets);
    }
  }, []);

  const connect = async (walletName: string) => {
    if (walletName !== "yoroi") throw new Error("Only Yoroi is supported");
    try {
      const api = await window.cardano.yoroi.enable();
      setConnectedWallet(walletName);
      setWalletStatus("connected");

      const usedAddresses = await api.getUsedAddresses();
      if (usedAddresses.length > 0) {
        setAddress(usedAddresses[0]);
      }

      const balanceHex = await api.getBalance();
      setBalance(balanceHex);

      return api;
    } catch (error) {
      console.error("Failed to connect to Yoroi:", error);
      throw error;
    }
  };

  const transfer = async (recipientAddress: string, amountADA: string) => {
    const tempWalletApi = await window.cardano.yoroi.enable();
    setIsTransferring(true);

    try {
      // 1. Fetch protocol parameters from Blockfrost
      const res = await fetch(
        "https://cardano-preprod.blockfrost.io/api/v0/epochs/latest/parameters",
        {
          headers: {
            project_id: process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID || "",
          },
        }
      );

      const protocolParams = await res.json();

      // 2. Import cardano-serialization-lib
      const Cardano = await import("@emurgo/cardano-serialization-lib-browser");

      const utxos = await tempWalletApi.getUtxos();
      const changeAddressHex = await tempWalletApi.getChangeAddress();
      const changeAddress = Cardano.Address.from_bytes(
        Buffer.from(changeAddressHex, "hex")
      );

      const txBuilderCfg = Cardano.TransactionBuilderConfigBuilder.new()
        .fee_algo(
          Cardano.LinearFee.new(
            Cardano.BigNum.from_str(protocolParams.min_fee_a.toString()),
            Cardano.BigNum.from_str(protocolParams.min_fee_b.toString())
          )
        )
        .coins_per_utxo_byte(
          Cardano.BigNum.from_str(protocolParams.coins_per_utxo_byte.toString())
        )
        .key_deposit(
          Cardano.BigNum.from_str(protocolParams.key_deposit.toString())
        )
        .pool_deposit(
          Cardano.BigNum.from_str(protocolParams.pool_deposit.toString())
        )
        .max_tx_size(protocolParams.max_tx_size)
        .max_value_size(protocolParams.max_val_size || 5000)
        .build();

      const txBuilder = Cardano.TransactionBuilder.new(txBuilderCfg);

      for (const utxoHex of utxos) {
        const utxo = Cardano.TransactionUnspentOutput.from_bytes(
          Buffer.from(utxoHex, "hex")
        );
        txBuilder.add_input(
          utxo.output().address(),
          utxo.input(),
          utxo.output().amount()
        );
      }

      const lovelaceAmount = Cardano.BigNum.from_str(
        (parseFloat(amountADA) * 1_000_000).toString()
      );

      const recipientAddr = Cardano.Address.from_bech32(recipientAddress);
      const output = Cardano.TransactionOutput.new(
        recipientAddr,
        Cardano.Value.new(lovelaceAmount)
      );
      txBuilder.add_output(output);

      txBuilder.add_change_if_needed(changeAddress);

      const txBody = txBuilder.build();
      const tx = Cardano.Transaction.new(
        txBody,
        Cardano.TransactionWitnessSet.new()
      );

      const txHex = Buffer.from(tx.to_bytes()).toString("hex");

      const signedTxHex = await tempWalletApi.signTx(txHex, true);
      const txHash = await tempWalletApi.submitTx(signedTxHex);

      const newBalance = await tempWalletApi.getBalance();
      setBalance(newBalance);

      return txHash;
    } catch (error) {
      console.error("Transfer failed:", error);
      throw error;
    } finally {
      setIsTransferring(false);
    }
  };

  const disconnect = () => {
    setConnectedWallet(null);
    setAddress("");
    setBalance("0");
    setWalletStatus("disconnected");
  };

  return {
    connectedWallet,
    availableWallets,
    connect,
    disconnect,
    transfer,
    isTransferring,
    isConnected: !!connectedWallet,
  };
};
