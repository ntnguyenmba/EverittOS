package com.everittventures.everittos.field;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.nio.file.Files;
import java.util.UUID;

@CapacitorPlugin(name = "EverittFieldStore")
public class EverittFieldStorePlugin extends Plugin {
    private SQLiteOpenHelper helper;
    @Override public void load() { helper = new SQLiteOpenHelper(getContext(), "everitt-field.sqlite", null, 1) {
        @Override public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE records(kind TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(kind, record_key))"); db.execSQL("CREATE TABLE outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, created_at INTEGER NOT NULL)"); }
        @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) {}
    }; }
    private String safe(String value) { return value.replaceAll("[^A-Za-z0-9_-]", "_"); }
    private File jobsDir() { File dir = new File(getContext().getFilesDir(), "jobs"); if (!dir.exists()) dir.mkdirs(); return dir; }
    @PluginMethod public void putRecord(PluginCall call) { String kind=call.getString("kind"),key=call.getString("key"),json=call.getString("json");if(kind==null||key==null||json==null){call.reject("Invalid field record.");return;}helper.getWritableDatabase().execSQL("INSERT OR REPLACE INTO records(kind,record_key,json,updated_at) VALUES(?,?,?,?)",new Object[]{kind,key,json,System.currentTimeMillis()});call.resolve(); }
    @PluginMethod public void getRecord(PluginCall call) { String kind=call.getString("kind"),key=call.getString("key");if(kind==null||key==null){call.reject("Invalid field record.");return;}Cursor cursor=helper.getReadableDatabase().rawQuery("SELECT json FROM records WHERE kind=? AND record_key=? LIMIT 1",new String[]{kind,key});JSObject result=new JSObject();if(cursor.moveToFirst())result.put("json",cursor.getString(0));else result.put("json",null);cursor.close();call.resolve(result); }
    @PluginMethod public void queue(PluginCall call) { String type=call.getString("type"),key=call.getString("key"),json=call.getString("json");if(type==null||key==null||json==null){call.reject("Invalid queued change.");return;}helper.getWritableDatabase().execSQL("INSERT INTO outbox(type,record_key,json,created_at) VALUES(?,?,?,?)",new Object[]{type,key,json,System.currentTimeMillis()});call.resolve(); }
    @PluginMethod public void listOutbox(PluginCall call) { Cursor cursor=helper.getReadableDatabase().rawQuery("SELECT id,type,record_key,json FROM outbox ORDER BY id ASC",null);JSArray items=new JSArray();while(cursor.moveToNext()){JSObject item=new JSObject();item.put("id",cursor.getLong(0));item.put("type",cursor.getString(1));item.put("key",cursor.getString(2));item.put("json",cursor.getString(3));items.put(item);}cursor.close();JSObject result=new JSObject();result.put("items",items);call.resolve(result); }
    @PluginMethod public void removeOutbox(PluginCall call) { Integer id=call.getInt("id");if(id==null){call.reject("Invalid queue id.");return;}helper.getWritableDatabase().execSQL("DELETE FROM outbox WHERE id=?",new Object[]{id});call.resolve(); }
    @PluginMethod public void savePhoto(PluginCall call) { String key=call.getString("key"),base64=call.getString("base64");if(key==null||base64==null){call.reject("Invalid photo.");return;}try{File file=new File(jobsDir(),safe(key)+"-"+UUID.randomUUID()+".jpg");Files.write(file.toPath(),Base64.decode(base64,Base64.DEFAULT));JSObject result=new JSObject();result.put("path",file.getAbsolutePath());call.resolve(result);}catch(Exception error){call.reject("Could not save photo.");} }
    @PluginMethod public void readPhoto(PluginCall call) { String path=call.getString("path");if(path==null){call.reject("Invalid photo path.");return;}try{File file=new File(path);if(!file.getCanonicalPath().startsWith(getContext().getFilesDir().getCanonicalPath())){call.reject("Invalid photo path.");return;}JSObject result=new JSObject();result.put("base64",file.exists()?Base64.encodeToString(Files.readAllBytes(file.toPath()),Base64.NO_WRAP):null);call.resolve(result);}catch(Exception error){call.reject("Could not read photo.");} }
    @PluginMethod public void deletePhoto(PluginCall call) { String path=call.getString("path");if(path==null){call.reject("Invalid photo path.");return;}try{File file=new File(path);if(!file.getCanonicalPath().startsWith(getContext().getFilesDir().getCanonicalPath())){call.reject("Invalid photo path.");return;}if(file.exists())file.delete();call.resolve();}catch(Exception error){call.reject("Could not delete photo.");} }
}
