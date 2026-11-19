// The game logo (the owner's artwork, transparent PNG converted to WebP) and the studio logo.
// Both languages use the English game logo, as the owner asked.
export const GAME_LOGO = 'brand/game-logo.webp';
export const GAME_LOGO_SMALL = 'brand/game-logo-small.webp';
export const STUDIO_LOGO = 'brand/assoum-studios.webp';
export function logoSVG(_lang?: string, small = false): string {
  return `<img src="${small ? GAME_LOGO_SMALL : GAME_LOGO}" alt="Wedding Hall Tycoon" draggable="false" style="width:100%;height:auto;display:block">`;
}
