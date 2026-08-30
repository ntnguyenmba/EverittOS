package com.everittventures.everittos.security;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "EverittBiometric")
public class EverittBiometricPlugin extends Plugin {
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod public void isAvailable(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("type", "biometric");
        call.resolve(result);
    }

    @PluginMethod public void verify(PluginCall call) {
        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null || BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS) != BiometricManager.BIOMETRIC_SUCCESS) {
            JSObject result = new JSObject(); result.put("verified", false); result.put("unavailable", true); call.resolve(result); return;
        }
        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authResult) { JSObject result = new JSObject(); result.put("verified", true); call.resolve(result); }
            @Override public void onAuthenticationError(int errorCode, CharSequence errString) { JSObject result = new JSObject(); result.put("verified", false); result.put("canceled", true); call.resolve(result); }
            @Override public void onAuthenticationFailed() { }
        });
        String reason = call.getString("reason", "Unlock EverittOS");
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder().setTitle("EverittOS").setSubtitle(reason).setNegativeButtonText("Use PIN").setAllowedAuthenticators(AUTHENTICATORS).build();
        prompt.authenticate(info);
    }
}
