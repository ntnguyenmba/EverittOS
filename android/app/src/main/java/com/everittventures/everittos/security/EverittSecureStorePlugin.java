package com.everittventures.everittos.security;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "EverittSecureStore")
public class EverittSecureStorePlugin extends Plugin {
    private static final String KEY_ALIAS = "everittos_secure_key_v1";
    private static final String PREFS = "everittos_secure_values_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    private SecretKey key() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        java.security.Key existing = keyStore.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
         .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
         .setKeySize(256)
         .build());
        return generator.generateKey();
    }

    @PluginMethod
    public void set(PluginCall call) {
        String storageKey = call.getString("key");
        String value = call.getString("value");
        if (storageKey == null || value == null) { call.reject("Invalid secure value."); return; }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String payload = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(encrypted, Base64.NO_WRAP);
            prefs().edit().putString(storageKey, payload).apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not save secure value.");
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String storageKey = call.getString("key");
        if (storageKey == null) { call.reject("Invalid secure key."); return; }
        String payload = prefs().getString(storageKey, null);
        JSObject result = new JSObject();
        if (payload == null) { result.put("value", null); call.resolve(result); return; }
        try {
            String[] parts = payload.split("\\.", 2);
            if (parts.length != 2) throw new IllegalStateException("Bad secure value");
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            String value = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            result.put("value", value);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read secure value.");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String storageKey = call.getString("key");
        if (storageKey == null) { call.reject("Invalid secure key."); return; }
        prefs().edit().remove(storageKey).apply();
        call.resolve();
    }
}
