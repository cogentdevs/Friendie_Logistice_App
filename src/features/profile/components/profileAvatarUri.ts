// API URLs are already resolved by Laravel PublicData::image; do not rebuild them.
// AuthController registration and CustomerController removal both use this exact
// shared placeholder. Other paths/names (including uploaded avatar.jpg) stay valid.
export function profileAvatarUri(value?: string | null): string | undefined {
  const uri = value?.trim();
  if (!uri) return undefined;
  try {
    if (new URL(uri).pathname.endsWith('/frontend/img/profiles/avatar.jpg'))
      return undefined;
  } catch {
    // Preserve existing image-loader error fallback for invalid persisted URLs.
  }
  return uri;
}
