// imports
const express = require('express');
const { Connection, 
        clusterApiUrl, 
        Keypair,
        PublicKey,
        LAMPORTS_PER_SOL, 
        SystemProgram, 
        TransactionMessage, 
        VersionedTransaction } = require('@solana/web3.js')
const dotenv = require('dotenv');

// configs
dotenv.config();
const port = process.env.PORT || 3000;
const app = express();

// route handlers
app.get('/transfer/:addr', async (req, res) => {
    const receiverAddr = req.params.addr;
    if (!isValidAddress(receiverAddr)) {
        res.status(400).send('Invalid receiver address');
        return;
    }
    let transferAmt = 0.5 * LAMPORTS_PER_SOL;
    if (req.query.amount) {
        transferAmt = req.query.amount;
        if (isNaN(transferAmt)) {
            res.status(400).send('Invalid transfer amount');
            return;
        }
        if (transferAmt.includes('.') && transferAmt.split('.')[1].length > 9) {
            res.status(400).send('Invalid amount, SOL can have atmost 9 places decimal precision');
            return;
        }
        transferAmt = parseFloat(transferAmt);
        if (transferAmt <= 0.0 || transferAmt > 3.0) {
            res.status(400).send('Invalid amount, atmost 3SOL can be sent at once');
            return;
        }
        transferAmt = transferAmt * LAMPORTS_PER_SOL;
    }
    try {
        const secret = JSON.parse(process.env.PRIVATE_KEY ?? '');
        const secretKey = Uint8Array.from(secret);
        const sender = Keypair.fromSecretKey(secretKey);
        const connection = new Connection(clusterApiUrl('devnet'));
        const balance = await connection.getBalance(sender.publicKey);
        if (balance < transferAmt) {
            res.status(500).send('Not enough SOL to send');
            return;
        }
        const ix = SystemProgram.transfer({
                        fromPubkey: sender.publicKey,
                        toPubkey: new PublicKey(receiverAddr),
                        lamports: transferAmt
                    });
        const blockhash = await connection.getLatestBlockhash().then((res) => res.blockhash);
        const message = new TransactionMessage({
                            payerKey: sender.publicKey,
                            recentBlockhash: blockhash,
                            instructions: [ix]
                        }).compileToV0Message();
        const tx = new VersionedTransaction(message);
        tx.sign([sender]);
        const signature = await connection.sendTransaction(tx);
        res.send(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (err) {
        res.status(500).send(`Failed to send SOL: ${err}`);
    }
});

// server initiation
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

// helper functions
function isValidAddress(input) {
    if (input.length < 32 || input.length > 44)
      return false;
    let asciiValue;
    for (let index=0; index<input.length; index++) {
      asciiValue = input.charCodeAt(index);
      if (asciiValue>47 && asciiValue<58
          || asciiValue>64 && asciiValue<91
          || asciiValue>96 && asciiValue<123)
          continue;
      return false;
    }
    if (input.includes('0')
        || input.includes('I')
        || input.includes('O')
        || input.includes('l'))
      return false;
    return true;
}