#import <React/RCTBridgeModule.h>

@interface FriendieAppMetadata : NSObject <RCTBridgeModule>
@end

@implementation FriendieAppMetadata
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }
- (NSDictionary *)constantsToExport
{
  NSString *version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  return version.length > 0 ? @{@"version": version} : @{};
}
@end
