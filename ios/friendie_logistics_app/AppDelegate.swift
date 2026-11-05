import UIKit
import FirebaseCore
#if canImport(GoogleMaps)
import GoogleMaps
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    }
    #if canImport(GoogleMaps)
    if let key = Bundle.main.object(forInfoDictionaryKey: "FriendieMapsAPIKey") as? String,
       !key.isEmpty, !key.hasPrefix("$(") {
      GMSServices.provideAPIKey(key)
    }
    #endif
    return true
  }
}
