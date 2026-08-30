package com.everittventures.everittos.field;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EverittFieldStore")
public class EverittFieldStorePlugin extends Plugin {
    private SQLiteOpenHelper helper;

    @Override
    public void load() {
        helper = new SQLiteOpenHelper(getContext(), "everitt-field.sqlite", null, 1) {
            @Override public void onCreate(SQLiteDatabase db) {
                db.execSQL("CREATE TABLE records(kind TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(kind, record_key))");
                db.execSQL("CREATE TABLE outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, created_at INTEGER NOT NULL)");
            }
            @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
        };
    }

    @PluginMethod
    public void putRecord(PluginCall call) {
        String kind = call.getString("kind"), key = call.getString("key"), json = call.getString("json");
        if (kind == null || key == null || json == null) { call.reject("Invalid field record."); return; }
        SQLiteDatabase db = helper.getWritableDatabase();
        db.execSQL("INSERT OR REPLACE INTO records(kind,record_key,json,updated_at) VALUES(?,?,?,?)", new Object[]{kind,key,json,System.currentTimeMillis()});
        call.resolve();
    }

    @PluginMethod
    public void getRecord(PluginCall call) {
        String kind = call.getString("kind"), key = call.getString("key");
        if (kind == null || key == null) { call.reject("Invalid field record."); return; }
        Cursor cursor = helper.getReadableDatabase().rawQuery("SELECT json FROM records WHERE kind=? AND record_key=? LIMIT 1", new String[]{kind,key});
        JSObject result = new JSObject();
        if (cursor.moveToFirst()) result.put("json", cursor.getString(0)); else result.put("json", null);
        cursor.close(); call.resolve(result);
    }

    @PluginMethod
    public void queue(PluginCall call) {
        String type = call.getString("type"), key = call.getString("key"), json = call.getString("json");
        if (type == null || key == null || json == null) { call.reject("Invalid queued change."); return; }
        helper.getWritableDatabase().execSQL("INSERT INTO outbox(type,record_key,json,created_at) VALUES(?,?,?,?)", new Object[]{type,key,json,System.currentTimeMillis()});
        call.resolve();
    }

    @PluginMethod
    public void listOutbox(PluginCall call) {
        Cursor cursor = helper.getReadableDatabase().rawQuery("SELECT id,type,record_key,json FROM outbox ORDER BY id ASC", null);
        JSArray items = new JSArray();
        while (cursor.moveToNext()) {
            JSObject item = new JSObject(); item.put("id", cursor.getLong(0)); item.put("type", cursor.getString(1)); item.put("key", cursor.getString(2)); item.put("json", cursor.getString(3)); items.put(item);
        }
        cursor.close(); JSObject result = new JSObject(); result.put("items", items); call.resolve(result);
    }

    @PluginMethod
    public void removeOutbox(PluginCall call) {
        Integer id = call.getInt("id"); if (id == null) { call.reject("Invalid queue id."); return; }
        helper.getWritableDatabase().execSQL("DELETE FROM outbox WHERE id=?", new Object[]{id}); call.resolve();
    }
}
