package com.everittventures.everittos;

import android.os.Bundle;

import com.everittventures.everittos.billing.EverittBillingPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EverittBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
