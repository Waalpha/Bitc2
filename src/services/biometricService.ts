/**
 * Utility to handle WebAuthn (Biometrics) registration and verification
 * This uses the browser's native PublicKeyCredential API
 */

export const isBiometricSupported = (): boolean => {
  return !!(window.PublicKeyCredential && 
            window.isSecureContext && 
            navigator.credentials && 
            navigator.credentials.create);
};

// Helper to convert base64/base64url to ArrayBuffer
const bufferFromBase64 = (base64: string) => {
  // Convert base64url to base64
  const standardBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  try {
    const binaryString = window.atob(standardBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    // If it's not actually base64, fallback to text encoding (though this should be avoided for IDs)
    console.warn("bufferFromBase64: atob failed, using text encoder fallback", e);
    return new TextEncoder().encode(base64).buffer;
  }
};

// Helper to convert ArrayBuffer to Base64url (standard for WebAuthn)
const bufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export async function registerBiometric(username: string, userId: string) {
  if (!isBiometricSupported()) {
    throw new Error("Biometrics not supported or requires a secure (HTTPS) context.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // We use the hostname as the RP ID. In dev, this is the ais-dev URL.
  const rpId = window.location.hostname;

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: challenge,
    rp: {
      name: "BITC Learning System",
      // Omit id to let it default to the current origin's domain
    },
    user: {
      id: new TextEncoder().encode(userId).buffer,
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" } // RS256
    ],
    authenticatorSelection: {
      userVerification: "preferred",
      residentKey: "discouraged",
    },
    attestation: "none",
    timeout: 60000,
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    if (!credential) throw new Error("Verification cancelled or failed.");

    return {
      credentialId: credential.id,
      rawId: bufferToBase64(credential.rawId),
    };
  } catch (error: any) {
    console.error("WebAuthn Registration Full Error:", error);
    if (error.name === 'NotAllowedError') {
      throw new Error("Biometric registration was denied, timed out, or cancelled. Please ensure you are on a secure connection and allowed the prompt.");
    }
    if (error.name === 'SecurityError') {
      throw new Error("Security Error: The browser blocked the biometric request. This might be due to iframe restrictions or an insecure context.");
    }
    throw new Error(`Device biometric registration failed (${error.name}): ${error.message}`);
  }
}

export async function verifyBiometric(credentialId: string) {
  if (!isBiometricSupported()) {
    throw new Error("Biometrics not supported or requires a secure (HTTPS) context.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge: challenge,
    allowCredentials: [{
      id: bufferFromBase64(credentialId),
      type: 'public-key',
    }],
    userVerification: "preferred",
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    return !!assertion;
  } catch (error: any) {
    console.error("WebAuthn Verification Error:", error);
    if (error.name === 'NotAllowedError') {
      throw new Error("Verification timed out or was cancelled.");
    }
    throw new Error(`Biometric verification failed: ${error.message}`);
  }
}
