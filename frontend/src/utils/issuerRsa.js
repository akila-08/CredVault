const DB_NAME = "credvault-issuer-keys";
const STORE_NAME = "rsa-keys";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readKey(wallet) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(wallet.toLowerCase());
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function saveKey(wallet, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
      .put(key, wallet.toLowerCase());
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

function toPem(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const base64 = btoa(binary).match(/.{1,64}/g).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

function hexBytes(hex) {
  return Uint8Array.from(hex.slice(2).match(/.{1,2}/g), (byte) => parseInt(byte, 16));
}

export async function signIssuerCertificateHash(wallet, hash, API) {
  if (!window.crypto?.subtle || !window.indexedDB) {
    throw new Error("This browser cannot securely store and use the university RSA key");
  }

  const { data } = await API.get("/api/auth/rsa-key");
  let keyRecord = await readKey(wallet);

  if (data.publicKey && !keyRecord) {
    throw new Error("This browser does not have the university RSA private key. Use the browser where it was first registered.");
  }
  if (!keyRecord) {
    const pair = await crypto.subtle.generateKey({
      name: "RSA-PSS", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
    }, false, ["sign", "verify"]);
    const publicKey = toPem(await crypto.subtle.exportKey("spki", pair.publicKey));
    await API.put("/api/auth/rsa-key", { publicKey });
    keyRecord = { privateKey: pair.privateKey, publicKey };
    await saveKey(wallet, keyRecord);
  } else if (!data.publicKey) {
    await API.put("/api/auth/rsa-key", { publicKey: keyRecord.publicKey });
  } else if (data.publicKey !== keyRecord.publicKey) {
    throw new Error("The locally stored RSA key does not match the university's registered public key");
  }

  const signature = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 }, keyRecord.privateKey, hexBytes(hash),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}



export async function rotateIssuerRSAKey(wallet, API) {
  if (!window.crypto?.subtle || !window.indexedDB) {
    throw new Error("Secure browser cryptography is unavailable.");
  }

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    throw new Error("Connect a valid university wallet first.");
  }

  const walletAddress = wallet.toLowerCase();

  // Generate a fresh RSA key pair.
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-PSS",
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );

  const publicKey = toPem(
    await crypto.subtle.exportKey("spki", pair.publicKey)
  );

  // Ask the authenticated university endpoint to register the new key.
  // Save the private key only after the backend accepts the rotation.
  await API.put("/api/auth/rsa-key/rotate", { publicKey });

  await saveKey(walletAddress, {
    privateKey: pair.privateKey,
    publicKey,
  });

  return {
    success: true,
    message: "RSA key rotated successfully.",
  };
}



export async function registerRotatedIssuerRSAKey(wallet, API, adminKey) {
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    throw new Error("Connect a valid university wallet first.");
  }

  if (!adminKey) {
    throw new Error("Please log in to the admin panel first.");
  }

  const walletAddress = wallet.toLowerCase();
  const keyRecord = await readKey(walletAddress);

  if (!keyRecord?.privateKey || !keyRecord?.publicKey) {
    throw new Error(
      "No locally stored RSA key found. Generate the new key first."
    );
  }

  await API.put(
    "/api/auth/rsa-key/rotate",
    {
      wallet: walletAddress,
      publicKey: keyRecord.publicKey,
    },
    {
      headers: {
        "x-admin-key": adminKey,
      },
    }
  );

  return {
    success: true,
    message: "RSA public key rotation completed.",
  };
}
