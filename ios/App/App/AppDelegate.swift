import UIKit
import Capacitor
import Foundation
import Security
import LocalAuthentication
import SQLite3

@objc(EverittSecureStorePlugin)
public class EverittSecureStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="EverittSecureStore"; public let jsName="EverittSecureStore"
    public let pluginMethods=[CAPPluginMethod(name:"set",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"get",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"remove",returnType:CAPPluginReturnPromise)]
    private let service="com.everittventures.everittos.secure"
    private func query(_ key:String)->[String:Any]{[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:key]}
    @objc func set(_ call:CAPPluginCall){guard let key=call.getString("key"),let value=call.getString("value"),let data=value.data(using:.utf8) else{call.reject("Invalid secure value.");return};let base=query(key);SecItemDelete(base as CFDictionary);var insert=base;insert[kSecValueData as String]=data;insert[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;SecItemAdd(insert as CFDictionary,nil)==errSecSuccess ? call.resolve():call.reject("Could not save secure value.")}
    @objc func get(_ call:CAPPluginCall){guard let key=call.getString("key") else{call.reject("Invalid secure key.");return};var read=query(key);read[kSecReturnData as String]=true;read[kSecMatchLimit as String]=kSecMatchLimitOne;var item:CFTypeRef?;let status=SecItemCopyMatching(read as CFDictionary,&item);if status==errSecItemNotFound{call.resolve(["value":NSNull()]);return};guard status==errSecSuccess,let data=item as? Data,let value=String(data:data,encoding:.utf8) else{call.reject("Could not read secure value.");return};call.resolve(["value":value])}
    @objc func remove(_ call:CAPPluginCall){guard let key=call.getString("key") else{call.reject("Invalid secure key.");return};let status=SecItemDelete(query(key) as CFDictionary);(status==errSecSuccess||status==errSecItemNotFound) ? call.resolve():call.reject("Could not remove secure value.")}
}

@objc(EverittBiometricPlugin)
public class EverittBiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="EverittBiometric"; public let jsName="EverittBiometric"
    public let pluginMethods=[CAPPluginMethod(name:"isAvailable",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"verify",returnType:CAPPluginReturnPromise)]
    @objc func isAvailable(_ call:CAPPluginCall){let context=LAContext();var error:NSError?;let available=context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,error:&error);let type:String=context.biometryType == .faceID ? "face" : context.biometryType == .touchID ? "fingerprint" : "none";call.resolve(["available":available,"type":type])}
    @objc func verify(_ call:CAPPluginCall){let context=LAContext();context.localizedCancelTitle="Use PIN";var error:NSError?;guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,error:&error) else{call.resolve(["verified":false,"unavailable":true]);return};context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,localizedReason:call.getString("reason") ?? "Unlock EverittOS"){success,authError in DispatchQueue.main.async{if success{call.resolve(["verified":true]);return};let code=(authError as? LAError)?.code;call.resolve(["verified":false,"canceled":code == .userCancel || code == .systemCancel || code == .appCancel])}}}
}

@objc(EverittFieldStorePlugin)
public class EverittFieldStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="EverittFieldStore"; public let jsName="EverittFieldStore"
    public let pluginMethods=[CAPPluginMethod(name:"putRecord",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"getRecord",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"queue",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"listOutbox",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"removeOutbox",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"savePhoto",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"readPhoto",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"deletePhoto",returnType:CAPPluginReturnPromise)]
    private var db:OpaquePointer?
    public override func load(){super.load();openDatabase()}
    deinit{if db != nil{sqlite3_close(db)}}
    private func baseDirectory()->URL{let base=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0];try? FileManager.default.createDirectory(at:base,withIntermediateDirectories:true);return base}
    private func openDatabase(){guard db==nil else{return};let url=baseDirectory().appendingPathComponent("everitt-field.sqlite");guard sqlite3_open(url.path,&db)==SQLITE_OK else{db=nil;return};sqlite3_exec(db,"CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, updated_at REAL NOT NULL, PRIMARY KEY(kind, record_key));",nil,nil,nil);sqlite3_exec(db,"CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, record_key TEXT NOT NULL, json TEXT NOT NULL, created_at REAL NOT NULL);",nil,nil,nil)}
    private func bind(_ statement:OpaquePointer?,_ index:Int32,_ value:String){sqlite3_bind_text(statement,index,(value as NSString).utf8String,-1,nil)}
    private func safeName(_ value:String)->String{let allowed=CharacterSet.alphanumerics.union(CharacterSet(charactersIn:"-_"));return value.unicodeScalars.map{allowed.contains($0) ? String($0):"_"}.joined()}
    @objc func putRecord(_ call:CAPPluginCall){guard let kind=call.getString("kind"),let key=call.getString("key"),let json=call.getString("json") else{call.reject("Invalid field record.");return};openDatabase();guard db != nil else{call.reject("Field cache unavailable.");return};var stmt:OpaquePointer?;sqlite3_prepare_v2(db,"INSERT INTO records(kind,record_key,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,record_key) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at;",-1,&stmt,nil);bind(stmt,1,kind);bind(stmt,2,key);bind(stmt,3,json);sqlite3_bind_double(stmt,4,Date().timeIntervalSince1970);let ok=sqlite3_step(stmt)==SQLITE_DONE;sqlite3_finalize(stmt);ok ? call.resolve():call.reject("Could not save field record.")}
    @objc func getRecord(_ call:CAPPluginCall){guard let kind=call.getString("kind"),let key=call.getString("key") else{call.reject("Invalid field record.");return};openDatabase();guard db != nil else{call.resolve(["json":NSNull()]);return};var stmt:OpaquePointer?;sqlite3_prepare_v2(db,"SELECT json FROM records WHERE kind=? AND record_key=? LIMIT 1;",-1,&stmt,nil);bind(stmt,1,kind);bind(stmt,2,key);if sqlite3_step(stmt)==SQLITE_ROW,let text=sqlite3_column_text(stmt,0){let json=String(cString:text);sqlite3_finalize(stmt);call.resolve(["json":json]);return};sqlite3_finalize(stmt);call.resolve(["json":NSNull()])}
    @objc func queue(_ call:CAPPluginCall){guard let type=call.getString("type"),let key=call.getString("key"),let json=call.getString("json") else{call.reject("Invalid queued change.");return};openDatabase();guard db != nil else{call.reject("Field cache unavailable.");return};var stmt:OpaquePointer?;sqlite3_prepare_v2(db,"INSERT INTO outbox(type,record_key,json,created_at) VALUES(?,?,?,?);",-1,&stmt,nil);bind(stmt,1,type);bind(stmt,2,key);bind(stmt,3,json);sqlite3_bind_double(stmt,4,Date().timeIntervalSince1970);let ok=sqlite3_step(stmt)==SQLITE_DONE;sqlite3_finalize(stmt);ok ? call.resolve():call.reject("Could not queue field change.")}
    @objc func listOutbox(_ call:CAPPluginCall){openDatabase();guard db != nil else{call.resolve(["items":[]]);return};var stmt:OpaquePointer?;sqlite3_prepare_v2(db,"SELECT id,type,record_key,json FROM outbox ORDER BY id ASC;",-1,&stmt,nil);var items:[[String:Any]]=[];while sqlite3_step(stmt)==SQLITE_ROW{items.append(["id":sqlite3_column_int64(stmt,0),"type":sqlite3_column_text(stmt,1).map{String(cString:$0)} ?? "","key":sqlite3_column_text(stmt,2).map{String(cString:$0)} ?? "","json":sqlite3_column_text(stmt,3).map{String(cString:$0)} ?? "{}"]) };sqlite3_finalize(stmt);call.resolve(["items":items])}
    @objc func removeOutbox(_ call:CAPPluginCall){guard let id=call.getInt("id") else{call.reject("Invalid queue id.");return};openDatabase();var stmt:OpaquePointer?;sqlite3_prepare_v2(db,"DELETE FROM outbox WHERE id=?;",-1,&stmt,nil);sqlite3_bind_int64(stmt,1,Int64(id));sqlite3_step(stmt);sqlite3_finalize(stmt);call.resolve()}
    @objc func savePhoto(_ call:CAPPluginCall){guard let key=call.getString("key"),let base64=call.getString("base64"),let data=Data(base64Encoded:base64) else{call.reject("Invalid photo.");return};let folder=baseDirectory().appendingPathComponent("jobs",isDirectory:true);try? FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);let path=folder.appendingPathComponent("\(safeName(key))-\(UUID().uuidString).jpg");do{try data.write(to:path,options:.atomic);call.resolve(["path":path.path])}catch{call.reject("Could not save photo.")}}
    @objc func readPhoto(_ call:CAPPluginCall){guard let path=call.getString("path") else{call.reject("Invalid photo path.");return};guard path.hasPrefix(baseDirectory().path),let data=try? Data(contentsOf:URL(fileURLWithPath:path)) else{call.resolve(["base64":NSNull()]);return};call.resolve(["base64":data.base64EncodedString()])}
    @objc func deletePhoto(_ call:CAPPluginCall){guard let path=call.getString("path"),path.hasPrefix(baseDirectory().path) else{call.reject("Invalid photo path.");return};try? FileManager.default.removeItem(atPath:path);call.resolve()}
}

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad(){super.capacitorDidLoad();bridge?.registerPluginInstance(EverittBillingPlugin());bridge?.registerPluginInstance(EverittFieldStorePlugin());bridge?.registerPluginInstance(EverittSecureStorePlugin());bridge?.registerPluginInstance(EverittBiometricPlugin())}
}

@UIApplicationMain
class AppDelegate:UIResponder,UIApplicationDelegate {
    var window:UIWindow?
    func application(_ application:UIApplication,didFinishLaunchingWithOptions launchOptions:[UIApplication.LaunchOptionsKey:Any]?)->Bool{true}
    func applicationWillResignActive(_ application:UIApplication){}
    func applicationDidEnterBackground(_ application:UIApplication){}
    func applicationWillEnterForeground(_ application:UIApplication){}
    func applicationDidBecomeActive(_ application:UIApplication){}
    func applicationWillTerminate(_ application:UIApplication){}
    func application(_ app:UIApplication,open url:URL,options:[UIApplication.OpenURLOptionsKey:Any]=[:])->Bool{ApplicationDelegateProxy.shared.application(app,open:url,options:options)}
    func application(_ application:UIApplication,continue userActivity:NSUserActivity,restorationHandler:@escaping([UIUserActivityRestoring]?)->Void)->Bool{ApplicationDelegateProxy.shared.application(application,continue:userActivity,restorationHandler:restorationHandler)}
}
