import { getStateFromPath } from '@react-navigation/native';
import { linking } from '../src/navigation/linking';
test.each(['listings/123', 'messages/456', 'post/send', 'profile/edit'])(
  'parses supported nested path %s',
  path => {
    expect(getStateFromPath(path, linking.config)).toBeDefined();
  },
);

test.each([
  ['onboarding/verified', 'VerifiedReliable'],
  ['onboarding/global', 'GlobalReach'],
])('resolves onboarding path %s to its intended route', (path, route) => {
  expect(getStateFromPath(path, linking.config)?.routes[0].name).toBe(route);
});

// No reset-token link is accepted before the HTTPS association and contract exist.
test.each([
  'reset-password/token?email=test%40example.test',
  'reset-password/',
  'reset-password/token',
  'reset-password/%00?email=invalid',
])('rejects unapproved reset path %s', path => {
  expect(getStateFromPath(path, linking.config)).toBeUndefined();
});
