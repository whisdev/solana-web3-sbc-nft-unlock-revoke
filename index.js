import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js"
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} from "@metaplex-foundation/js"

import base58 from "bs58"
import * as fs from "fs"

// Type admin private key
const adminKey = "type admin private key"

// Type user private key
const userKey = "type user private key"

// example data for a new NFT
const nftData = [{
  name: "SBC #18",
  symbol: "sbc",
  description: "Example nft for SBC project",
  sellerFeeBasisPoints: 500,
  imageFile: "image/1.jpg",
}]

// freeze authority (account 2)
const admin = Keypair.fromSecretKey(
  base58.decode(
    adminKey
  )
);

const NETWORK = "devnet";
const RPC = "https://api.devnet.solana.com";

const connection = new Connection(RPC);

const metaplex = Metaplex.make(connection, { cluster: NETWORK })
  .use(keypairIdentity(owner))
  .use(bundlrStorage({
    address: 'https://devnet.bundlr.network',
    providerUrl: RPC,
    timeout: 60000,
  }));

const balance = await connection.getBalance(owner.publicKey);
console.log("Current balance is", balance / LAMPORTS_PER_SOL);

async function makeUnlockAndRevokeTransaction(nft) {

  const revokeTransaction = await revokeDelegate(nft);
  const unlockTransaction = await makeUnLockTransaction(nft);

  if (!revokeDelegate || !unlockTransaction) {
    console.log("Can't make transaction");
  }

  const transaction = new Transaction().add(
    ...unlockTransaction,
    ...revokeTransaction
  )

  const bh = await connection.getLatestBlockhash();
  transaction.feePayer = owner.publicKey;
  transaction.recentBlockhash = bh.blockhash;
  transaction.lastValidBlockHeight = bh.lastValidBlockHeight

  console.log("====><=====", transaction, "====><=====");

  transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: true
  })

  await sendAndConfirmTransaction(connection, transaction, [owner, admin])

}

async function revokeDelegate(nft) {

  metaplex.use(keypairIdentity(owner));

  const delegateTransaction = metaplex.nfts().builders().revoke({
    nftOrSft: nft,
    authority: owner,
    delegate: {
      type: "UtilityV1",
      delegate: admin.publicKey,
      owner: owner.publicKey,
    }
  });

  const delegateTransactions = delegateTransaction.getInstructions();
  return delegateTransactions;
}

async function makeUnLockTransaction(nft) {

  metaplex.use(keypairIdentity(admin));

  const unLockTransaction = metaplex.nfts().builders().unlock({
    nftOrSft: nft,
    authority: {
      __kind: 'tokenDelegate',
      type: "UtilityV1",
      delegate: admin,
      owner: owner.publicKey,
    }
  });

  const unlockTransactions = unLockTransaction.getInstructions();
  return unlockTransactions;
}

async function main() {

  //   const mintAddress = new PublicKey("7tEYHWJCd9AwMiMJDwPWTorTLU2um48swCb1P8vghJCY");
  //   const nft = await metaplex.nfts().findByMint({ mintAddress })

  await makeUnlockAndRevokeTransaction(nft);

}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
